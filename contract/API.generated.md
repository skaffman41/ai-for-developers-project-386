# Календарь звонков — HTTP API

Generated from [main.tsp](main.tsp) via [openapi.json](openapi.json). Do not edit by hand.

## GET /api/availability

Получить свободные интервалы по московскому времени

Сегодня и следующие 13 московских дней; будни 09:00–18:00, начала через 30 минут строго после asOf. Чтение не резервирует время.

Responses: 200, 400, 404, 422, 500, 503.

## POST /api/bookings

Подтвердить бронирование с безопасным повтором

Idempotency-Key — UUID. Сравниваются исходные значения JSON, порядок свойств незначим. Структурные ошибки parseable JSON с действительным ключом сохраняются как окончательный VALIDATION_ERROR. Нормализация trim явная, длина проверяется после неё. Переполненные при разборе JSON числа (например 1e400) нельзя интерпретировать: INVALID_REQUEST/unknown до регистрации попытки. rejected возвращается только после commit; технический сбой оставляет unknown. Результаты не имеют TTL.

Responses: 201, 400, 404, 409, 422, 500, 503.

## GET /api/event-types

Получить типы встреч, новые первыми

Порядок: время создания по убыванию, затем монотонный номер создания по убыванию. Названия могут совпадать; displayCode устойчив и уникален.

Responses: 200, 400, 500, 503.

## POST /api/event-types

Создать тип встречи с сохранённым результатом попытки

Idempotency-Key — UUID. Сравниваются исходные значения JSON, порядок свойств незначим. Структурные ошибки parseable JSON с действительным ключом сохраняются как окончательный VALIDATION_ERROR. Нормализация trim явная, длина проверяется после неё. Переполненные при разборе JSON числа (например 1e400) нельзя интерпретировать: INVALID_REQUEST/unknown до регистрации попытки. rejected возвращается только после commit; технический сбой оставляет unknown. Результаты не имеют TTL.

Responses: 201, 400, 409, 422, 500, 503.

## GET /api/owner/bookings

Бронирования владельца календаря

Whole saved history, independent of the guest horizon. Default upcoming: endsAt > X-Server-Time, ascending startsAt. past: endsAt <= X-Server-Time, descending startsAt. all: ascending startsAt. Equal starts use ascending opaque id.

Responses: 200, 400, 500, 503.

## GET /health

Проверить здоровье сервиса

Responses: 200, 400, 500, 503.

## Schemas

```json
{
  "Availability": {
    "type": "object",
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
        "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
        "format": "date"
      },
      "timeZone": {
        "type": "string",
        "enum": ["Europe/Moscow"]
      },
      "firstDate": {
        "type": "string",
        "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
        "format": "date"
      },
      "lastDate": {
        "type": "string",
        "pattern": "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
        "format": "date"
      },
      "asOf": {
        "type": "string",
        "pattern": "Z$",
        "format": "date-time"
      },
      "slots": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/Slot"
        }
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "AvailabilityResponse": {
    "type": "object",
    "required": ["data"],
    "properties": {
      "data": {
        "$ref": "#/components/schemas/Availability"
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "Booking": {
    "type": "object",
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
        "pattern": "Z$",
        "format": "date-time"
      },
      "endsAt": {
        "type": "string",
        "pattern": "Z$",
        "format": "date-time"
      },
      "guestName": {
        "type": "string",
        "minLength": 1,
        "maxLength": 100,
        "pattern": "^(?=\\S)[^\\r\\n\\u2028\\u2029]*\\S$|^\\S$"
      },
      "guestEmail": {
        "type": "string",
        "maxLength": 254,
        "format": "email"
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "BookingDraft": {
    "type": "object",
    "required": ["eventTypeId", "startsAt", "guestName", "guestEmail"],
    "properties": {
      "eventTypeId": {
        "type": "string",
        "minLength": 1
      },
      "startsAt": {
        "type": "string",
        "pattern": "Z$",
        "format": "date-time"
      },
      "guestName": {
        "type": "string",
        "minLength": 1,
        "maxLength": 100,
        "pattern": "^(?=\\S)[^\\r\\n\\u2028\\u2029]*\\S$|^\\S$"
      },
      "guestEmail": {
        "type": "string",
        "maxLength": 254,
        "format": "email"
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "BookingError404": {
    "type": "object",
    "required": ["idempotencyKey", "outcome", "error"],
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "outcome": {
        "type": "string",
        "enum": ["rejected"]
      },
      "error": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "enum": ["EVENT_TYPE_NOT_FOUND"]
          },
          "message": {
            "type": "string",
            "minLength": 1
          },
          "fieldErrors": {
            "type": "object",
            "additionalProperties": {
              "$ref": "#/components/schemas/NonEmptyString"
            }
          }
        },
        "required": ["code", "message"],
        "unevaluatedProperties": {
          "not": {}
        }
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "BookingError409": {
    "oneOf": [
      {
        "$ref": "#/components/schemas/WriteError409"
      },
      {
        "$ref": "#/components/schemas/BookingRefusal409"
      }
    ]
  },
  "BookingError422": {
    "type": "object",
    "required": ["idempotencyKey", "outcome", "error"],
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "outcome": {
        "type": "string",
        "enum": ["rejected"]
      },
      "error": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "enum": ["VALIDATION_ERROR", "TIME_UNAVAILABLE"]
          },
          "message": {
            "type": "string",
            "minLength": 1
          },
          "fieldErrors": {
            "type": "object",
            "additionalProperties": {
              "$ref": "#/components/schemas/NonEmptyString"
            }
          }
        },
        "required": ["code", "message"],
        "unevaluatedProperties": {
          "not": {}
        }
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "BookingRefusal409": {
    "type": "object",
    "required": ["idempotencyKey", "outcome", "error"],
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "outcome": {
        "type": "string",
        "enum": ["rejected"]
      },
      "error": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "enum": ["SLOT_TAKEN"]
          },
          "message": {
            "type": "string",
            "minLength": 1
          },
          "fieldErrors": {
            "type": "object",
            "additionalProperties": {
              "$ref": "#/components/schemas/NonEmptyString"
            }
          }
        },
        "required": ["code", "message"],
        "unevaluatedProperties": {
          "not": {}
        }
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "Bookings": {
    "type": "object",
    "required": ["data"],
    "properties": {
      "data": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/Booking"
        }
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "CreateBookingInput": {
    "type": "object",
    "required": ["eventTypeId", "startsAt", "guestName", "guestEmail"],
    "properties": {
      "eventTypeId": {
        "type": "string"
      },
      "startsAt": {
        "type": "string"
      },
      "guestName": {
        "type": "string"
      },
      "guestEmail": {
        "type": "string"
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "CreateEventTypeInput": {
    "type": "object",
    "required": ["name", "durationMinutes"],
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
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "CreatedBooking": {
    "type": "object",
    "required": ["idempotencyKey", "data"],
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "data": {
        "$ref": "#/components/schemas/Booking"
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "CreatedEventType": {
    "type": "object",
    "required": ["idempotencyKey", "data"],
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "data": {
        "$ref": "#/components/schemas/EventType"
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "EventType": {
    "type": "object",
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
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "EventTypeDraft": {
    "type": "object",
    "required": ["name", "durationMinutes"],
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
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "EventTypes": {
    "type": "object",
    "required": ["data"],
    "properties": {
      "data": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/EventType"
        }
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "Health": {
    "type": "object",
    "required": ["status"],
    "properties": {
      "status": {
        "type": "string",
        "enum": ["ok"]
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "NonEmptyString": {
    "type": "string",
    "minLength": 1
  },
  "ReadError": {
    "type": "object",
    "required": ["error"],
    "properties": {
      "error": {
        "type": "object",
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
        },
        "required": ["code", "message"],
        "unevaluatedProperties": {
          "not": {}
        }
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "Slot": {
    "type": "object",
    "required": ["startsAt", "endsAt"],
    "properties": {
      "startsAt": {
        "type": "string",
        "pattern": "Z$",
        "format": "date-time"
      },
      "endsAt": {
        "type": "string",
        "pattern": "Z$",
        "format": "date-time"
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "UtcInstant": {
    "type": "string",
    "pattern": "Z$",
    "format": "date-time"
  },
  "WriteError": {
    "type": "object",
    "required": ["outcome", "error"],
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
              "$ref": "#/components/schemas/NonEmptyString"
            }
          }
        },
        "required": ["code", "message"],
        "unevaluatedProperties": {
          "not": {}
        }
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "WriteError400": {
    "type": "object",
    "required": ["outcome", "error"],
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "outcome": {
        "type": "string",
        "enum": ["unknown"]
      },
      "error": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "enum": ["INVALID_REQUEST"]
          },
          "message": {
            "type": "string",
            "minLength": 1
          },
          "fieldErrors": {
            "type": "object",
            "additionalProperties": {
              "$ref": "#/components/schemas/NonEmptyString"
            }
          }
        },
        "required": ["code", "message"],
        "unevaluatedProperties": {
          "not": {}
        }
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "WriteError409": {
    "type": "object",
    "required": ["idempotencyKey", "outcome", "error"],
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "outcome": {
        "type": "string",
        "enum": ["unknown"]
      },
      "error": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "enum": ["IDEMPOTENCY_KEY_REUSED"]
          },
          "message": {
            "type": "string",
            "minLength": 1
          },
          "fieldErrors": {
            "type": "object",
            "additionalProperties": {
              "$ref": "#/components/schemas/NonEmptyString"
            }
          }
        },
        "required": ["code", "message"],
        "unevaluatedProperties": {
          "not": {}
        }
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "WriteError422": {
    "type": "object",
    "required": ["idempotencyKey", "outcome", "error"],
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "outcome": {
        "type": "string",
        "enum": ["rejected"]
      },
      "error": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "enum": ["VALIDATION_ERROR"]
          },
          "message": {
            "type": "string",
            "minLength": 1
          },
          "fieldErrors": {
            "type": "object",
            "additionalProperties": {
              "$ref": "#/components/schemas/NonEmptyString"
            }
          }
        },
        "required": ["code", "message"],
        "unevaluatedProperties": {
          "not": {}
        }
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "WriteError500": {
    "type": "object",
    "required": ["outcome", "error"],
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "outcome": {
        "type": "string",
        "enum": ["unknown"]
      },
      "error": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "enum": ["INTERNAL_ERROR"]
          },
          "message": {
            "type": "string",
            "minLength": 1
          },
          "fieldErrors": {
            "type": "object",
            "additionalProperties": {
              "$ref": "#/components/schemas/NonEmptyString"
            }
          }
        },
        "required": ["code", "message"],
        "unevaluatedProperties": {
          "not": {}
        }
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  },
  "WriteError503": {
    "type": "object",
    "required": ["outcome", "error"],
    "properties": {
      "idempotencyKey": {
        "type": "string",
        "format": "uuid"
      },
      "outcome": {
        "type": "string",
        "enum": ["unknown"]
      },
      "error": {
        "type": "object",
        "properties": {
          "code": {
            "type": "string",
            "enum": ["TEMPORARILY_UNAVAILABLE"]
          },
          "message": {
            "type": "string",
            "minLength": 1
          },
          "fieldErrors": {
            "type": "object",
            "additionalProperties": {
              "$ref": "#/components/schemas/NonEmptyString"
            }
          }
        },
        "required": ["code", "message"],
        "unevaluatedProperties": {
          "not": {}
        }
      }
    },
    "unevaluatedProperties": {
      "not": {}
    }
  }
}
```
