# PIS UAE Marketplace - Vendor Feature Development

## Design Guidelines
- **Theme**: Dark tech theme (slate-950 background, blue-500/600 accents)
- **Brand**: PIS UAE
- **Color Palette**: Primary #0F172A, Accent #3B82F6, Success #10B981, Warning #F59E0B
- **Typography**: System default (Inter/sans-serif), bold headings, light body text

## Development Tasks

### 1. Vendor Signup Page (`/vendor/signup`)
- Form with business name, description
- Auto-sets commission_rate to 15% (platform default)
- Requires user to be logged in first
- Creates vendor record via `client.entities.vendors.create`

### 2. Vendor Dashboard Page (`/vendor/dashboard`)
- Overview stats: total products, total sales, commission rate, net earnings
- Product management table: list vendor's products with edit/delete
- Add New Product form (modal/inline)
- Products are created with seller_id = current user's ID

### 3. Update Header Component
- Add "Sell on PIS UAE" button/link for non-vendors
- Add "Vendor Dashboard" link for existing vendors
- Check vendor status on auth

### 4. Update App.tsx Routes
- Add /vendor/signup route
- Add /vendor/dashboard route

### 5. Update Footer Branding
- Change "TechParts" to "PIS UAE" in Index.tsx footer

## Files to Create/Edit
1. `src/pages/VendorSignup.tsx` - NEW
2. `src/pages/VendorDashboard.tsx` - NEW
3. `src/components/Header.tsx` - EDIT (add vendor links)
4. `src/App.tsx` - EDIT (add routes)
5. `src/pages/Index.tsx` - EDIT (update footer branding)