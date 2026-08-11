import { useRef } from "react";

/**
 * A button that looks clickable but is actually hiding a real
 * file input underneath (browsers style file inputs ugly by default,
 * so this is the standard trick: hide the input, trigger it via a ref).
 *
 * Props:
 *  - icon: the SVG shown on the button
 *  - label: tooltip text
 *  - accept: which file types to allow (e.g. "image/*" or ".pdf,.txt")
 *  - onFileSelected: function called with the chosen File object
 */
function UploadButton({ icon, label, accept, onFileSelected, disabled }) {
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    e.target.value = ""; // reset so selecting the same file twice still fires change
  };

  return (
    <>
      <button
        type="button"
        className="icon-button"
        title={label}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {icon}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        style={{ display: "none" }}
      />
    </>
  );
}

export default UploadButton;