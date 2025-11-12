'use client';

import { useCompletion } from '@ai-sdk/react';
import { Button } from '@repo/design-system/components/ui/button';
import { Card } from '@repo/design-system/components/ui/card';
import { Loader2, Mic, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

interface AudioRecording {
  blob: Blob;
  duration: number;
  id: string;
}

interface InputField {
  name: string;
  type: string;
}

interface VoiceInputProps {
  inputFields: InputField[];
  onSuggestionsReceived: (suggestions: Record<string, { value: string; confidence: string }>) => void;
}

export function VoiceInput({ inputFields, onSuggestionsReceived }: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioRecordings, setAudioRecordings] = useState<AudioRecording[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number>(0);

  const completion = useCompletion({
    api: '/api/scribe/template-voice',
    body: {
      model: 'gemini-2.5-pro', // Use Gemini for audio support
    },
  });

  const maxRecordings = 1;
  const canRecord = audioRecordings.length < maxRecordings && !isRecording;

  const handleStartRecording = async () => {
    if (!canRecord) {
      toast.error(`Maximal ${maxRecordings} Aufnahme möglich`);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      recordingStartTimeRef.current = Date.now();

      mediaRecorder.addEventListener('dataavailable', (event) => {
        audioChunksRef.current.push(event.data);
      });

      mediaRecorder.addEventListener('stop', () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: 'audio/webm',
        });
        const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
        const newRecording: AudioRecording = {
          blob: audioBlob,
          duration,
          id: `audio-${Date.now()}`,
        };
        setAudioRecordings((prev) => [...prev, newRecording]);
        for (const track of stream.getTracks()) {
          track.stop();
        }
      });

      mediaRecorder.start();
      setIsRecording(true);
      toast.success('Aufnahme gestartet');
    } catch (error) {
      console.error('Error starting recording:', error);
      toast.error('Fehler beim Starten der Aufnahme');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success('Aufnahme beendet');
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  const handleRemoveRecording = (id: string) => {
    setAudioRecordings((prev) => prev.filter((recording) => recording.id !== id));
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleProcess = useCallback(async () => {
    if (audioRecordings.length === 0) {
      toast.error('Bitte nehmen Sie zuerst eine Audioaufnahme auf');
      return;
    }

    setIsProcessing(true);

    try {
      // Convert audio to base64
      const audioFiles = await Promise.all(
        audioRecordings.map(async (recording) => {
          const reader = new FileReader();
          const audioBase64 = await new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const base64String = (reader.result as string).split(',')[1];
              resolve(base64String);
            };
            reader.readAsDataURL(recording.blob);
          });
          return {
            data: audioBase64,
            mimeType: recording.blob.type,
          };
        })
      );

      // Prepare the prompt with input field information
      const prompt = JSON.stringify({
        inputFields: inputFields.map((field) => ({
          name: field.name,
          type: field.type,
        })),
        instruction: 'Extract relevant information from the voice input for these fields',
      });

      // Send to API
      await completion.complete(prompt, {
        body: {
          model: 'gemini-2.5-pro',
          audioFiles,
          inputFields: inputFields.map((field) => ({
            name: field.name,
            type: field.type,
          })),
        },
      });

      if (completion.error) {
        toast.error(completion.error.message || 'Fehler beim Verarbeiten');
        return;
      }

      // Parse the AI response to extract suggestions
      if (completion.completion) {
        try {
          // Try to extract JSON from the response
          const jsonMatch = completion.completion.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const suggestions = JSON.parse(jsonMatch[0]);
            onSuggestionsReceived(suggestions);
            toast.success('Vorschläge erfolgreich generiert');
          } else {
            toast.error('Keine strukturierten Vorschläge gefunden');
          }
        } catch (parseError) {
          console.error('Error parsing suggestions:', parseError);
          toast.error('Fehler beim Verarbeiten der Vorschläge');
        }
      }

      // Clear audio after processing
      setAudioRecordings([]);
    } catch (error) {
      console.error('Error processing voice input:', error);
      toast.error('Fehler beim Verarbeiten der Spracheingabe');
    } finally {
      setIsProcessing(false);
    }
  }, [audioRecordings, inputFields, completion, onSuggestionsReceived]);

  // Don't show the component if there are no input fields
  if (inputFields.length === 0) {
    return null;
  }

  return (
    <Card className="mb-4 p-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-sm">Spracheingabe</h3>
            <p className="text-muted-foreground text-xs">
              Nehmen Sie Audio auf, um Felder automatisch zu füllen
            </p>
          </div>
          <Button
            className={isRecording ? 'bg-solarized-red hover:bg-solarized-red/90' : ''}
            disabled={isProcessing || (!canRecord && !isRecording)}
            onClick={handleToggleRecording}
            size="sm"
            title={isRecording ? 'Aufnahme stoppen' : 'Aufnahme starten'}
            type="button"
            variant={isRecording ? 'destructive' : 'default'}
          >
            {isRecording ? (
              <>
                <X className="mr-2 h-4 w-4" />
                Stoppen
              </>
            ) : (
              <>
                <Mic className="mr-2 h-4 w-4" />
                Aufnehmen
              </>
            )}
          </Button>
        </div>

        {/* Audio Recordings */}
        {audioRecordings.length > 0 && (
          <div className="space-y-2">
            {audioRecordings.map((recording, index) => (
              <div
                className="flex items-center justify-between rounded-lg border border-solarized-green/20 bg-solarized-green/10 p-3"
                key={recording.id}
              >
                <div className="flex items-center gap-2 text-sm text-solarized-green">
                  <Mic className="h-4 w-4" />
                  <span>
                    Aufnahme {index + 1} ({formatDuration(recording.duration)})
                  </span>
                </div>
                <Button
                  disabled={isProcessing}
                  onClick={() => handleRemoveRecording(recording.id)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button
              className="w-full"
              disabled={isProcessing}
              onClick={handleProcess}
              size="sm"
              type="button"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verarbeite...
                </>
              ) : (
                'Felder automatisch füllen'
              )}
            </Button>
          </div>
        )}

        {/* Privacy Warning */}
        <div className="rounded-lg border border-solarized-red/20 bg-solarized-red/10 p-3">
          <p className="text-solarized-red text-xs leading-relaxed">
            ⚠️ <strong>Datenschutzhinweis:</strong> Die Audioaufnahme wird an eine
            KI gesendet. Verwenden Sie keine echten Patientendaten.
          </p>
        </div>
      </div>
    </Card>
  );
}
