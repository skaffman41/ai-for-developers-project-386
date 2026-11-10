# Календарь звонков — HTTP API

Generated from [openapi.json](openapi.json). Do not edit by hand.

## GET /health

Проверить здоровье сервиса

Responses: 200, 400, 500, 503.

## GET /api/event-types

Получить типы встреч, новые первыми

Порядок: время создания по убыванию, затем монотонный номер создания по убыванию. Названия могут совпадать; displayCode устойчив и уникален.

Responses: 200, 400, 500, 503.

## POST /api/event-types

Создать тип встречи с сохранённым результатом попытки

Idempotency-Key — UUID. Сравниваются исходные значения JSON, порядок свойств незначим. Структурные ошибки parseable JSON с действительным ключом сохраняются как окончательный VALIDATION_ERROR. Нормализация trim явная, длина проверяется после неё. Переполненные при разборе JSON числа (например 1e400) нельзя интерпретировать: INVALID_REQUEST/unknown до регистрации попытки. rejected возвращается только после commit; технический сбой оставляет unknown. Результаты не имеют TTL.

Responses: 201, 400, 409, 422, 500, 503.

## GET /api/availability

Получить свободные интервалы по московскому времени

Сегодня и следующие 13 московских дней; будни 09:00–18:00, начала через 30 минут строго после asOf. Чтение не резервирует время.

Responses: 200, 400, 404, 422, 500, 503.

## GET /api/owner/bookings

Бронирования владельца календаря

Whole saved history, independent of the guest horizon. Default upcoming: endsAt > X-Server-Time, ascending startsAt. past: endsAt <= X-Server-Time, descending startsAt. all: ascending startsAt. Equal starts use ascending opaque id.

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
              "TEMPORARILY_UNAVAILABLE",
              "EVENT_TYPE_NOT_FOUND",
              "VALIDATION_ERROR",
              "TIME_UNAVAILABLE"
            ]
          },
          "message": {
            "type": "string",
            "minLength": 1
          }
        }
      }
    }
  },
  "CreateEventTypeInput": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "name": {
        "type": "string"
      },
      "durationMinutes": {
        "type": "integer"
      },
      "description": {
        "type": "string"
      }
    },
    "required": ["name", "durationMinutes"]
  },
  "EventTypeDraft": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
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
      }
    },
    "required": ["name", "durationMinutes"]
  },
  "CreatedEventType": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "data": {
        "$ref": "#/components/schemas/EventType"
      }
    },
    "required": ["idempotencyKey", "data"]
  },
  "WriteError": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "outcome": {
        "type": "string",
        "enum": ["rejected", "unknown"]
      },
      "error": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "code": {
            "type": "string",
            "enum": [
              "VALIDATION_ERROR",
              "IDEMPOTENCY_KEY_REUSED",
              "INVALID_REQUEST",
              "INTERNAL_ERROR",
              "TEMPORARILY_UNAVAILABLE"
            ]
          },
          "message": {
            "type": "string",
            "minLength": 1
          },
          "fieldErrors": {
            "type": "object",
            "additionalProperties": {
              "type": "string",
              "minLength": 1
            }
          }
        },
        "required": ["code", "message"]
      }
    },
    "required": ["error", "outcome"]
  },
  "WriteError400": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "outcome": {
        "type": "string",
        "const": "unknown"
      },
      "error": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "code": {
            "type": "string",
            "const": "INVALID_REQUEST"
          },
          "message": {
            "type": "string",
            "minLength": 1
          },
          "fieldErrors": {
            "type": "object",
            "additionalProperties": {
              "type": "string",
              "minLength": 1
            }
          }
        },
        "required": ["code", "message"]
      }
    },
    "required": ["error", "outcome"]
  },
  "WriteError409": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "outcome": {
        "type": "string",
        "const": "unknown"
      },
      "error": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "code": {
            "type": "string",
            "const": "IDEMPOTENCY_KEY_REUSED"
          },
          "message": {
            "type": "string",
            "minLength": 1
          },
          "fieldErrors": {
            "type": "object",
            "additionalProperties": {
              "type": "string",
              "minLength": 1
            }
          }
        },
        "required": ["code", "message"]
      }
    },
    "required": ["error", "outcome", "idempotencyKey"]
  },
  "WriteError422": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "outcome": {
        "type": "string",
        "const": "rejected"
      },
      "error": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "code": {
            "type": "string",
            "const": "VALIDATION_ERROR"
          },
          "message": {
            "type": "string",
            "minLength": 1
          },
          "fieldErrors": {
            "type": "object",
            "additionalProperties": {
              "type": "string",
              "minLength": 1
            }
          }
        },
        "required": ["code", "message"]
      }
    },
    "required": ["error", "outcome", "idempotencyKey"]
  },
  "WriteError500": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "outcome": {
        "type": "string",
        "const": "unknown"
      },
      "error": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "code": {
            "type": "string",
            "const": "INTERNAL_ERROR"
          },
          "message": {
            "type": "string",
            "minLength": 1
          },
          "fieldErrors": {
            "type": "object",
            "additionalProperties": {
              "type": "string",
              "minLength": 1
            }
          }
        },
        "required": ["code", "message"]
      }
    },
    "required": ["error", "outcome"]
  },
  "WriteError503": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "outcome": {
        "type": "string",
        "const": "unknown"
      },
      "error": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "code": {
            "type": "string",
            "const": "TEMPORARILY_UNAVAILABLE"
          },
          "message": {
            "type": "string",
            "minLength": 1
          },
          "fieldErrors": {
            "type": "object",
            "additionalProperties": {
              "type": "string",
              "minLength": 1
            }
          }
        },
        "required": ["code", "message"]
      }
    },
    "required": ["error", "outcome"]
  },
  "Slot": {
    "type": "object",
    "additionalProperties": false,
    "required": ["startsAt", "endsAt"],
    "properties": {
      "startsAt": {
        "type": "string",
        "format": "date-time",
        "pattern": "Z$"
      },
      "endsAt": {
        "type": "string",
        "format": "date-time",
        "pattern": "Z$"
      }
    }
  },
  "Availability": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "eventTypeId",
      "date",
      "timeZone",
      "firstDate",
      "lastDate",
      "asOf",
      "slots"
    ],
    "properties": {
      "eventTypeId": {
        "type": "string",
        "minLength": 1
      },
      "date": {
        "type": "string",
        "format": "date",
        "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"
      },
      "timeZone": {
        "type": "string",
        "const": "Europe/Moscow"
      },
      "firstDate": {
        "type": "string",
        "format": "date",
        "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"
      },
      "lastDate": {
        "type": "string",
        "format": "date",
        "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$"
      },
      "asOf": {
        "type": "string",
        "format": "date-time",
        "pattern": "Z$"
      },
      "slots": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/Slot"
        }
      }
    }
  },
  "AvailabilityResponse": {
    "type": "object",
    "additionalProperties": false,
    "required": ["data"],
    "properties": {
      "data": {
        "$ref": "#/components/schemas/Availability"
      }
    }
  },
  "Booking": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "id",
      "eventType",
      "startsAt",
      "endsAt",
      "guestName",
      "guestEmail"
    ],
    "properties": {
      "id": {
        "type": "string",
        "minLength": 1
      },
      "eventType": {
        "$ref": "#/components/schemas/EventType"
      },
      "startsAt": {
        "type": "string",
        "format": "date-time",
        "pattern": "Z$"
      },
      "endsAt": {
        "type": "string",
        "format": "date-time",
        "pattern": "Z$"
      },
      "guestName": {
        "type": "string",
        "minLength": 1,
        "maxLength": 100,
        "pattern": "^(?=\\S)[^\\r\\n\\u2028\\u2029]*\\S$|^\\S$"
      },
      "guestEmail": {
        "type": "string",
        "format": "email",
        "maxLength": 254
      }
    }
  },
  "Bookings": {
    "type": "object",
    "additionalProperties": false,
    "required": ["data"],
    "properties": {
      "data": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/Booking"
        }
      }
    }
  }
}
```
