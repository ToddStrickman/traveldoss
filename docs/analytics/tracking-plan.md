# Tracking plan

## Contact form (`/contact`)

| Event | When | Properties |
| --- | --- | --- |
| `contact_message_submitted` | A contact message is accepted by the server function | `category`, `message_length` (length only — never message content) |
| `contact_message_failed` | Submission rejected (validation, throttle, insert error) | `category`, `reason` (truncated error text) |
