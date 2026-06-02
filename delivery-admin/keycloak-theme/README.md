# AmarBazaar Keycloak Theme

Custom Keycloak login theme matching the AmarBazaar admin panel branding.

## How to Install

1. Copy the `amarbazaar` folder to your Keycloak themes directory:

   ```
   Copy: delivery-admin/keycloak-theme/amarbazaar/
   To:   C:\keycloak\themes\amarbazaar\
   ```

   Final structure should be:
   ```
   C:\keycloak\themes\
     └── amarbazaar\
         └── login\
             ├── theme.properties
             └── resources\
                 └── css\
                     └── login.css
   ```

2. Restart Keycloak (close and reopen keycloak-start.bat)

3. Apply the theme in Keycloak Admin Console:
   - Open http://localhost:9090
   - Go to realm: delivery-admin
   - Realm Settings → Themes
   - Set Login theme = amarbazaar
   - Click Save

## What's Customized

- Emerald green (#10b981) primary color matching the admin panel
- White card with rounded corners and soft shadow
- Delivery truck logo icon in emerald circle
- Inter font family
- Green accent bar at the bottom of the card
- Styled inputs with emerald focus ring
- Styled submit button matching the admin panel buttons
- Error messages styled in red
- Background color #f0f4f3 matching the admin panel background
