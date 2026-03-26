import { useDropzone } from 'react-dropzone'
import './UploadZone.css'

interface UploadZoneProps {
  onFile: (file: File) => void
  disabled?: boolean
}

export function UploadZone({ onFile, disabled }: UploadZoneProps) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted) => {
      if (accepted.length > 0) {
        onFile(accepted[0])
      }
    },
    accept: { 'video/*': [] },
    multiple: false,
    disabled,
  })

  return (
    <div
      {...getRootProps()}
      className={[
        'upload-zone',
        isDragActive ? 'upload-zone--drag-active' : '',
        disabled ? 'upload-zone--disabled' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input {...getInputProps()} />
      <svg
        className="upload-zone__icon"
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 16V4" />
        <path d="M8 8l4-4 4 4" />
        <path d="M4 20h16" />
      </svg>
      <p className="upload-zone__label">
        {isDragActive ? 'Drop to upload' : 'Drop a video or click to upload'}
      </p>
    </div>
  )
}
