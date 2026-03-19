# TechParts Marketplace - Frontend Development Plan

## Design Guidelines

### Design References
- **Newegg.com**: Tech-focused product grid, category navigation
- **Amazon.com**: Clean product cards, search/filter patterns
- **Style**: Modern Dark Tech + Clean Commerce

### Color Palette
- Primary Background: #0F172A (Dark Navy)
- Secondary Background: #1E293B (Slate Dark)
- Card Background: #1E293B with border #334155
- Accent: #3B82F6 (Electric Blue)
- Accent Hover: #2563EB (Deeper Blue)
- Success: #10B981 (Emerald)
- Warning: #F59E0B (Amber)
- Text Primary: #F8FAFC (Near White)
- Text Secondary: #94A3B8 (Slate Gray)
- Text Muted: #64748B (Muted Slate)

### Typography
- Font: Inter (system default from shadcn)
- Heading1: font-bold text-4xl
- Heading2: font-semibold text-2xl
- Body: font-normal text-sm/text-base
- Price: font-bold text-lg text-emerald-400

### Key Component Styles
- Cards: Dark slate bg, subtle border, rounded-xl, hover lift effect
- Buttons: Blue gradient, white text, rounded-lg
- Badges: Small rounded pills for categories/conditions

### Generated Images (CDN URLs)
1. hero-banner-tech.jpg: https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-18/8db7c9fe-7e9e-4248-a343-e5e92c3ed9e4.png
2. parts-collection-flatlay.jpg: https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-18/c1384985-4f46-41a1-af84-fd758bd4107a.png
3. laptop-repair-workshop.jpg: https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-18/b4f787f3-521f-433a-adbb-011f6bfd6924.png
4. electronics-store-interior.jpg: https://mgx-backend-cdn.metadl.com/generate/images/1040407/2026-03-18/d76cb9c0-b3bc-4f6b-b368-0d175b59f0c2.png

---

## Database Schema (Already Created)
- **products**: id, seller_id, title, description, price, category, condition, image_url, stock, status, created_at (public, create_only=false)
- **orders**: id, user_id, product_id, seller_id, quantity, total_price, status, created_at (user-specific, create_only=true)
- **cart_items**: id, user_id, product_id, quantity, created_at (user-specific, create_only=true)

---

## Files to Create (8 files max)

1. **src/pages/Index.tsx** - Homepage with hero banner, featured products, category cards
2. **src/pages/Products.tsx** - Product listing page with search, filters, category/condition filters
3. **src/pages/ProductDetail.tsx** - Single product detail page with add-to-cart
4. **src/pages/Cart.tsx** - Shopping cart page with quantity management and checkout
5. **src/pages/Orders.tsx** - Order history page (requires auth)
6. **src/components/Header.tsx** - Navigation header with logo, search, cart icon, auth
7. **src/components/ProductCard.tsx** - Reusable product card component
8. **src/App.tsx** - Updated router with all routes

## Data Flow
- Products: `client.entities.products.query()` (public data, create_only=false)
- Cart: `client.entities.cart_items.query/create/update/delete()` (user-specific)
- Orders: `client.entities.orders.query/create()` (user-specific)
- Auth: `client.auth.me()`, `client.auth.toLogin()`, `client.auth.logout()`