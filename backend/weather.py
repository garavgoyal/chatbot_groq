"""The get_weather tool: turning a place — or the user's own device — into a
current-conditions reading from Open-Meteo.

Kept next to storage.py rather than in controllers/ because, like storage,
it's a service the controllers call rather than a request handler itself."""
import httpx

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

# WMO weather codes. Without these the model only ever sees a temperature, so
# when it's asked "is it raining?" it has nothing to answer from and makes
# something up — the condition text is what stops that.
WEATHER_CODES = {
    0: "clear sky",
    1: "mainly clear", 2: "partly cloudy", 3: "overcast",
    45: "foggy", 48: "freezing fog",
    51: "light drizzle", 53: "moderate drizzle", 55: "heavy drizzle",
    56: "light freezing drizzle", 57: "freezing drizzle",
    61: "light rain", 63: "moderate rain", 65: "heavy rain",
    66: "light freezing rain", 67: "freezing rain",
    71: "light snow", 73: "moderate snow", 75: "heavy snow",
    77: "snow grains",
    80: "light rain showers", 81: "rain showers", 82: "violent rain showers",
    85: "light snow showers", 86: "snow showers",
    95: "thunderstorm", 96: "thunderstorm with hail", 99: "thunderstorm with heavy hail",
}

# Values a model reaches for when it wants "wherever the user is" but the tool
# only offers a city field. Treated as "use their device location" rather than
# geocoded literally, which is how "your city here" used to become a failure.
PLACEHOLDER_CITIES = {
    "here", "current location", "my location", "your location", "user location",
    "your city", "your city here", "my city", "current city", "local", "unknown",
}


def _city_from_timezone(timezone: str) -> str:
    """"Asia/Kolkata" -> "Kolkata". A coarse fallback, but it needs no location
    permission — which matters because browsers only expose geolocation on
    HTTPS/localhost, so over a LAN IP this is often all we get."""
    if not timezone or "/" not in timezone:
        return ""
    return timezone.rsplit("/", 1)[-1].replace("_", " ")


async def _geocode(http_client, city: str):
    res = await http_client.get(GEOCODE_URL, params={"name": city, "count": 1})
    results = res.json().get("results")
    if not results:
        return None

    top = results[0]
    label = ", ".join(part for part in (top.get("name"), top.get("country")) if part)
    return top["latitude"], top["longitude"], label


async def _fetch_current(http_client, lat: float, lon: float, label: str):
    res = await http_client.get(FORECAST_URL, params={
        "latitude": lat,
        "longitude": lon,
        # The old call asked for `current_weather=true`, which returns only
        # temperature and windspeed. These are the fields the assistant is
        # actually asked about.
        "current": "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
        "timezone": "auto",
    })
    current = res.json()["current"]

    return {
        "location": label,
        "conditions": WEATHER_CODES.get(current.get("weather_code"), "unknown"),
        "temperature_celsius": current.get("temperature_2m"),
        "feels_like_celsius": current.get("apparent_temperature"),
        "relative_humidity_percent": current.get("relative_humidity_2m"),
        "precipitation_mm": current.get("precipitation"),
        "windspeed_kmh": current.get("wind_speed_10m"),
    }


async def get_weather(city: str = None, use_current_location: bool = False, user_location=None):
    """Resolve a weather request to real numbers.

    Falls through three ways of working out *where*: the device's exact
    coordinates, the city name the model supplied, then the city implied by
    the device timezone. Returns an {"error": ...} dict rather than raising,
    because the result is fed straight back to the model as tool output.
    """
    city = (city or "").strip()
    wants_here = use_current_location or city.lower() in PLACEHOLDER_CITIES
    if wants_here:
        city = ""

    try:
        async with httpx.AsyncClient(timeout=10) as http_client:
            # 1. Exact coordinates from the browser — the only truly precise option.
            if wants_here and user_location and user_location.latitude is not None:
                return await _fetch_current(
                    http_client, user_location.latitude, user_location.longitude, "your current location"
                )

            # 2. A city the model named.
            if city:
                found = await _geocode(http_client, city)
                if not found:
                    return {"error": f"Couldn't find location: {city}"}
                return await _fetch_current(http_client, *found)

            # 3. No coordinates and no city: fall back to the device timezone.
            fallback_city = _city_from_timezone(getattr(user_location, "timezone", "") or "")
            if fallback_city:
                found = await _geocode(http_client, fallback_city)
                if found:
                    lat, lon, label = found
                    return await _fetch_current(http_client, lat, lon, f"{label} (guessed from your timezone)")

            return {
                "error": "No location available. Ask the user which city they want the weather for.",
            }
    except (httpx.HTTPError, KeyError, ValueError, TypeError) as e:
        return {"error": f"Weather lookup failed: {e}"}
