# ImiTune API - Quick Reference

This document provides a concise overview of the Imitune backend API for frontend integration.

---

### **Endpoint**

| Method | URL                                                                                  |
| :----- | :----------------------------------------------------------------------------------- |
| `POST` | `https://imitune-backend-ek2udc5sb-chris-projects-3c0d9932.vercel.app/api/search` |

---

### **Data Flow**

#### **Request Body**
Send a JSON object with the embedding vector.

```json
{
  "embedding": [0.123, -0.456, 0.789, "..."]
}

#### **Success Response (200 OK)**
The server will return a list of matching sounds.
```json
{
  "results": [
    {
      "id": "000000045123",
      "score": 0.98765,
      "freesound_url": "[https://freesound.org/people/user/sounds/12345/](https://freesound.org/people/user/sounds/12345/)"
    },
    {
      "id": "000000012897",
      "score": 0.95432,
      "freesound_url": "[https://freesound.org/people/another/sounds/67890/](https://freesound.org/people/another/sounds/67890/)"
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