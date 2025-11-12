# Voice Input for Templates

## Overview
This feature adds voice input capability to template input fields, allowing users to record audio and have AI automatically extract relevant information to populate the fields.

## Components

### VoiceInput.tsx
- Records audio using the MediaRecorder API
- Sends audio to the `/api/scribe/template-voice` endpoint
- Displays AI-generated suggestions for input fields
- Maximum 1 audio recording at a time

### ContentSection.tsx
- Integrates VoiceInput component above the Inputs form
- Manages suggestions state and passes them to input fields
- Extracts input field metadata for the voice processing

### Inputs.tsx & InfoInput.tsx
- Enhanced to accept and display AI suggestions
- Visual indicators for AI-suggested values (green badge and background)
- Automatic suggestion application when field is empty
- Manual override capability - users can edit suggested values
- Suggestion indicator clears when user manually edits

## API Endpoint

### POST /api/scribe/template-voice
Processes voice input and extracts structured data for template fields.

**Request Body:**
```json
{
  "model": "gemini-2.5-pro",
  "audioFiles": [
    {
      "data": "base64_encoded_audio",
      "mimeType": "audio/webm"
    }
  ],
  "inputFields": [
    {
      "name": "Patient Name",
      "type": "text"
    },
    {
      "name": "Age",
      "type": "number"
    }
  ]
}
```

**Response:**
Streams AI-generated JSON with suggestions for each field:
```json
{
  "Patient Name": {
    "value": "John Doe",
    "confidence": "high"
  },
  "Age": {
    "value": "45",
    "confidence": "medium"
  }
}
```

## Langfuse Prompt Configuration

**IMPORTANT:** You need to create a Langfuse prompt named `template_voice_extraction` with the following structure:

### Prompt Name
`template_voice_extraction`

### Prompt Template (Chat format)
```
System Message:
You are a medical documentation assistant. Your task is to extract relevant information from voice input and suggest values for specific template fields.

Guidelines:
- Only suggest values when you find relevant information in the voice input
- Leave the value as an empty string if no relevant information is found
- Be conservative - don't guess or make up information
- For numeric fields, only suggest numeric values
- For date fields, use format DD.MM.YYYY
- Provide confidence levels: high (explicitly mentioned), medium (implied), or low (uncertain)

User Message:
{{extractionPrompt}}

Please respond with a JSON object following this structure:
{
  "field_name": {
    "value": "suggested value or empty string",
    "confidence": "high|medium|low"
  }
}
```

### Prompt Labels
- Production: `production`
- Staging: `staging`

### Model Configuration
- Max Tokens: 4000
- Temperature: 0.3 (for deterministic extraction)

## User Flow

1. User opens a template with input fields
2. VoiceInput component appears above the input fields
3. User clicks "Aufnehmen" (Record) button
4. User speaks information relevant to the template fields
5. User clicks "Stoppen" (Stop) to end recording
6. User clicks "Felder automatisch füllen" (Auto-fill fields)
7. Audio is sent to AI for processing
8. AI extracts relevant information and returns suggestions
9. Suggestions are automatically applied to empty fields
10. Fields with suggestions show:
    - Green "AI-Vorschlag" badge
    - Light green background
    - Green border
11. User can:
    - Accept the suggestion by leaving it as is
    - Override by manually typing (clears suggestion indicator)

## Privacy & Security

- Privacy warning is displayed to users
- No patient data should be included in audio recordings
- Audio is sent to external AI service (Gemini 2.5 Pro)
- Audio recordings are cleared after processing

## Future Enhancements

- Support for multiple audio recordings
- Confidence threshold for auto-applying suggestions
- Manual accept/reject buttons for each suggestion
- Voice recording playback before processing
- Support for more field types (dates, selections)
