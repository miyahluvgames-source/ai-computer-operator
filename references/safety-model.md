# Safety Model

AI Computer Operator uses a conservative action model.

## Risk Levels

| Level | Examples | Default behavior |
| --- | --- | --- |
| Low | read page, take screenshot, extract visible text, open public URL | proceed after normal planning |
| Medium | fill non-sensitive form fields, click navigation, download public file | proceed when target and intent are clear |
| High | submit forms, send messages, change settings, upload files | ask for explicit approval |
| Blocked | financial action, destructive change, secret entry, access bypass | do not proceed unless the user provides exact approval and the host policy allows it |

## Stop Conditions

Stop and ask before:

- irreversible confirmation dialogs
- account settings changes
- payment or checkout pages
- sensitive personal information
- login credentials or private keys
- pages that show another person's private data
- unexpected downloads or permission prompts

## Verification Ladder

Use the strongest available evidence:

1. DOM/state read
2. Screenshot
3. Final URL
4. Exported report
5. Command output
6. User-visible preview

Do not treat an automation command returning success as enough by itself.
