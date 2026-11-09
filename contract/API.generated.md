# Календарь звонков — HTTP API

Generated from [openapi.json](openapi.json). Do not edit by hand.

## GET /health

Проверить здоровье сервиса

Responses: 200, 400, 500, 503.

## GET /api/event-types

Получить типы встреч, новые первыми

Порядок: время создания по убыванию, затем монотонный номер создания по убыванию. Названия могут совпадать; displayCode устойчив и уникален.

Responses: 200, 400, 500, 503.

## Schemas

```json
{
  "Health": {
    "type": "object",
    "additionalProperties": false,
    "required": ["status"],
    "properties": {
      "status": {
        "const": "ok",
        "type": "string"
      }
    }
  },
  "EventType": {
    "type": "object",
    "additionalProperties": false,
    "required": ["id", "name", "durationMinutes", "displayCode"],
    "properties": {
      "id": {
        "type": "string",
        "minLength": 1
      },
      "name": {
        "type": "string",
        "minLength": 1,
        "maxLength": 100,
        "pattern": "^(?=\\S)[^\\r\\n\\u2028\\u2029]*\\S$|^\\S$"
      },
      "durationMinutes": {
        "type": "integer",
        "minimum": 1,
        "maximum": 540
      },
      "description": {
        "type": "string",
        "minLength": 1,
        "maxLength": 2000,
        "pattern": "^\\S(?:[\\s\\S]*\\S)?$"
      },
      "displayCode": {
        "type": "string",
        "pattern": "^В-[0-9]{6,}$"
      }
    }
  },
  "EventTypes": {
    "type": "object",
    "additionalProperties": false,
    "required": ["data"],
    "properties": {
      "data": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/EventType"
        }
      }
    }
  },
  "ReadError": {
    "type": "object",
    "additionalProperties": false,
    "required": ["error"],
    "properties": {
      "error": {
        "type": "object",
        "additionalProperties": false,
        "required": ["code", "message"],
        "properties": {
          "code": {
            "type": "string",
            "enum": [
              "INVALID_REQUEST",
              "INTERNAL_ERROR",
              "TEMPORARILY_UNAVAILABLE"
            ]
          },
          "message": {
            "type": "string",
            "minLength": 1
          }
        }
      }
    }
  }
}
```
