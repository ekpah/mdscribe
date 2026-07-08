"use client"

import { useCallback, useEffect, useState, type MouseEvent } from "react"
import { Check, ChevronsUpDown, Mic, MicOff } from "lucide-react"

import { cn } from "@repo/design-system/lib/utils"
import { Button } from "@repo/design-system/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu"
import { LiveWaveform } from "@repo/design-system/components/ui/live-waveform"

export interface AudioDevice {
  deviceId: string
  label: string
  groupId: string
}

interface MicSelectorProps {
  value?: string
  onValueChange?: (deviceId: string) => void
  onDeviceChange?: (device: AudioDevice | null) => void
  muted?: boolean
  onMutedChange?: (muted: boolean) => void
  disabled?: boolean
  className?: string
  requestPermissionOnMount?: boolean
}

export const getMicrophoneErrorMessage = (error: unknown) => {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return "Der Browser erlaubt den Zugriff auf das Mikrofon nicht. Bitte gib die Mikrofonberechtigung frei und versuche es erneut."
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "Kein Mikrofon gefunden. Bitte schließe ein Mikrofon an und versuche es erneut."
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "Das Mikrofon kann nicht verwendet werden. Bitte prüfe, ob es von einer anderen App genutzt wird."
    }
    if (error.name === "OverconstrainedError" || error.name === "ConstraintNotSatisfiedError") {
      return "Das ausgewählte Mikrofon ist nicht verfügbar. Bitte wähle ein anderes Mikrofon aus."
    }
    if (error.name === "SecurityError") {
      return "Der Browser blockiert den Mikrofonzugriff. Bitte prüfe die Website- und Browser-Berechtigungen."
    }
  }

  return "Mikrofone konnten nicht geladen werden. Bitte prüfe die Browser-Berechtigungen und versuche es erneut."
}

export function MicSelector({
  value,
  onValueChange,
  onDeviceChange,
  muted,
  onMutedChange,
  disabled,
  className,
  requestPermissionOnMount = false,
}: MicSelectorProps) {
  const { devices, loading, error, hasPermission, loadDevices } =
    useAudioDevices({ requestPermissionOnMount })
  const [selectedDevice, setSelectedDevice] = useState<string>(value || "")
  const [internalMuted, setInternalMuted] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Use controlled muted if provided, otherwise use internal state
  const isMuted = muted !== undefined ? muted : internalMuted

  // Update internal state when controlled value changes
  useEffect(() => {
    if (value !== undefined) {
      setSelectedDevice(value)
    }
  }, [value])

  // Select first device by default
  const defaultDeviceId = devices[0]?.deviceId || ""
  useEffect(() => {
    if (!selectedDevice && defaultDeviceId) {
      const newDevice = defaultDeviceId
      setSelectedDevice(newDevice)
      onValueChange?.(newDevice)
    }
  }, [defaultDeviceId, selectedDevice, onValueChange])

  const currentDevice = devices.find((d) => d.deviceId === selectedDevice) ||
    devices[0] || {
      label: loading ? "Wird geladen..." : "Kein Mikrofon",
      deviceId: "",
      groupId: "",
    }

  useEffect(() => {
    onDeviceChange?.(currentDevice.deviceId ? currentDevice : null)
  }, [
    currentDevice.deviceId,
    currentDevice.groupId,
    currentDevice.label,
    onDeviceChange,
  ])

  const handleDeviceSelect = (deviceId: string, e?: MouseEvent) => {
    e?.preventDefault()
    setSelectedDevice(deviceId)
    onValueChange?.(deviceId)
  }

  const handleDropdownOpenChange = async (open: boolean) => {
    setIsDropdownOpen(open)
    if (open && !hasPermission && !loading) {
      await loadDevices()
    }
  }

  const toggleMute = () => {
    const newMuted = !isMuted
    if (muted === undefined) {
      setInternalMuted(newMuted)
    }
    onMutedChange?.(newMuted)
  }

  const isPreviewActive = isDropdownOpen && !isMuted

  return (
    <DropdownMenu onOpenChange={handleDropdownOpenChange}>
      <DropdownMenuTrigger render={<Button
          variant="ghost"
          size="sm"
          className={cn(
            "hover:bg-accent flex w-40 min-w-0 shrink cursor-pointer items-center gap-1.5 sm:w-48",
            className
          )}
          disabled={loading || disabled}
        >
          {isMuted ? (
            <MicOff className="h-4 w-4 flex-shrink-0" />
          ) : (
            <Mic className="h-4 w-4 flex-shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate text-left text-xs sm:text-sm">
            {currentDevice.label}
          </span>
          <ChevronsUpDown className="h-3 w-3 flex-shrink-0" />
        </Button>} />
      <DropdownMenuContent align="center" side="top" className="w-72">
        {loading ? (
          <DropdownMenuItem disabled>Mikrofone werden geladen...</DropdownMenuItem>
        ) : error ? (
          <DropdownMenuItem disabled>Fehler: {error}</DropdownMenuItem>
        ) : (
          devices.map((device) => (
            <DropdownMenuItem
              key={device.deviceId}
              onClick={(e) => handleDeviceSelect(device.deviceId, e)}
              onSelect={(e) => e.preventDefault()}
              className="flex items-center justify-between"
            >
              <span className="truncate">{device.label}</span>
              {selectedDevice === device.deviceId && (
                <Check className="h-4 w-4 flex-shrink-0" />
              )}
            </DropdownMenuItem>
          ))
        )}
        {devices.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="flex items-center gap-2 p-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault()
                  toggleMute()
                }}
                className="h-8 gap-2"
              >
                {isMuted ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                <span className="text-sm">{isMuted ? "Mikrofon aktivieren" : "Stummschalten"}</span>
              </Button>
              <div className="bg-accent ml-auto w-16 overflow-hidden rounded-md p-1.5">
                <LiveWaveform
                  active={isPreviewActive}
                  deviceId={selectedDevice || defaultDeviceId}
                  mode="static"
                  height={15}
                  barWidth={3}
                  barGap={1}
                />
              </div>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface UseAudioDevicesOptions {
  requestPermissionOnMount?: boolean
}

function useAudioDevices({
  requestPermissionOnMount = false,
}: UseAudioDevicesOptions = {}) {
  const [devices, setDevices] = useState<AudioDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasPermission, setHasPermission] = useState(false)

  const loadDevicesWithoutPermission = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const deviceList = await navigator.mediaDevices.enumerateDevices()

      const audioInputs = deviceList
        .filter((device) => device.kind === "audioinput")
        .map((device) => {
          let cleanLabel =
            device.label || `Mikrofon ${device.deviceId.slice(0, 8)}`
          cleanLabel = cleanLabel.replace(/\s*\([^)]*\)/g, "").trim()

          return {
            deviceId: device.deviceId,
            label: cleanLabel,
            groupId: device.groupId,
          }
        })

      setDevices(audioInputs)
    } catch (err) {
      setError(getMicrophoneErrorMessage(err))
      console.error("Error getting audio devices:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDevicesWithPermission = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const tempStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      })
      tempStream.getTracks().forEach((track) => track.stop())

      const deviceList = await navigator.mediaDevices.enumerateDevices()

      const audioInputs = deviceList
        .filter((device) => device.kind === "audioinput")
        .map((device) => {
          let cleanLabel =
            device.label || `Mikrofon ${device.deviceId.slice(0, 8)}`
          cleanLabel = cleanLabel.replace(/\s*\([^)]*\)/g, "").trim()

          return {
            deviceId: device.deviceId,
            label: cleanLabel,
            groupId: device.groupId,
          }
        })

      setDevices(audioInputs)
      setHasPermission(true)
    } catch (err) {
      setError(getMicrophoneErrorMessage(err))
      console.error("Error getting audio devices:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (requestPermissionOnMount) {
      void loadDevicesWithPermission()
      return
    }

    void loadDevicesWithoutPermission()
  }, [
    loadDevicesWithPermission,
    loadDevicesWithoutPermission,
    requestPermissionOnMount,
  ])

  useEffect(() => {
    const handleDeviceChange = () => {
      if (hasPermission) {
        loadDevicesWithPermission()
      } else {
        loadDevicesWithoutPermission()
      }
    }

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange)

    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      )
    }
  }, [hasPermission, loadDevicesWithPermission, loadDevicesWithoutPermission])

  return {
    devices,
    loading,
    error,
    hasPermission,
    loadDevices: loadDevicesWithPermission,
  }
}
