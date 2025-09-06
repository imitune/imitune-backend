# ImiTune API - Quick Reference

This document provides a concise overview of the Imitune backend API for frontend integration.

---

## **Search Endpoint**

### **Search for Sounds**
| Method | URL |
| :----- | :--- |
| `POST` | `https://imitune-backend-bptzlaz7e-chris-projects-3c0d9932.vercel.app/api/search` |

#### **Request Body**
Send a JSON object with the embedding vector.

```json
{
  "embedding": [0.123, -0.456, 0.789, "..."]
}
```

#### **Success Response (200 OK)**
The server will return a list of matching sounds.
```json
{
  "results": [
    {
      "id": "000000045123",
      "score": 0.98765,
      "freesound_url": "https://freesound.org/people/user/sounds/12345/"
    },
    {
      "id": "000000012897",
      "score": 0.95432,
      "freesound_url": "https://freesound.org/people/another/sounds/67890/"
    }
  ]
}
```

#### **Error Response (4xx/5xx)**
The server will return an error object.
```json
{
  "error": "Error message describing the issue."
}
```

---

## **Feedback Endpoint**

### **Submit User Feedback**
| Method | URL |
| :----- | :--- |
| `POST` | `https://imitune-backend-bptzlaz7e-chris-projects-3c0d9932.vercel.app/api/feedback` |

#### **Request Body**
Send a JSON object with audio data and feedback ratings.

```json
{
  "audioQuery": "data:audio/webm;base64,<base64-encoded-audio-data>",
  "freesound_urls": [
    "https://freesound.org/people/user/sounds/12345/",
    null,
    "https://freesound.org/people/user/sounds/67890/"
  ],
  "ratings": [
    "like",
    null,
    "dislike"
  ]
}
```

#### **Success Response (200 OK)**
The server will return confirmation of successful submission.
```json
{
  "message": "Feedback submitted successfully",
  "audioId": "unique-uuid-identifier",
  "audioUrl": "https://vercel-blob-storage-url/audio-file.webm",
  "metadataUrl": "https://vercel-blob-storage-url/metadata-file.json"
}
```

#### **Error Response (4xx/5xx)**
The server will return an error object.
```json
{
  "error": "Error message describing the issue."
}
```

---

### **Important Notes**

1. **Audio Format**: Audio data must be base64-encoded WebM format with data URL prefix (`data:audio/webm;base64,`)
2. **Array Length**: `freesound_urls` and `ratings` arrays must be the same length
3. **Rating Values**: Valid values are `"like"`, `"dislike"`, or `null` for no rating
4. **Timeout**: Large audio files may cause timeout errors (keep under 5 minutes)

### **Base URL**
All endpoints are served from: `https://imitune-backend-bptzlaz7e-chris-projects-3c0d9932.vercel.app`

### **CORS**
All endpoints support CORS and can be called from web browsers.

---

*Last Updated: September 2025 Sat 6 23:07*
