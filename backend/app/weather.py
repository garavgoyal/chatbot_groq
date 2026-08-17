import httpx

WEATHER_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get the current real-time weather for a city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {"type": "string", "description": "City name, e.g. Amritsar"}
                },
                "required": ["city"]
            }
        }
    }
]


async def get_weather(city: str):
    async with httpx.AsyncClient() as http_client:
        geo_res = await http_client.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name": city, "count": 1}
        )
        geo_data = geo_res.json()
        if not geo_data.get("results"):
            return {"error": f"Couldn't find location: {city}"}

        lat = geo_data["results"][0]["latitude"]
        lon = geo_data["results"][0]["longitude"]

        weather_res = await http_client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={"latitude": lat, "longitude": lon, "current_weather": True}
        )
        current = weather_res.json()["current_weather"]

        return {
            "city": city,
            "temperature_celsius": current["temperature"],
            "windspeed_kmh": current["windspeed"]
        }
