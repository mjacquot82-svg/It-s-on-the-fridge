# It's On The Fridge - Magnet Design Tool

A mobile-first Progressive Web App (PWA) built with React + Vite for designing and ordering custom magnets.

## Features

✨ **Mobile-First Design** - Optimized for smartphones and tablets  
🧲 **Two Magnet Types** - Round and Rectangle options  
📸 **Photo Upload** - Upload photos from your device  
✏️ **Advanced Image Cropping** - Powered by `react-easy-crop`  
🔍 **Zoom & Pan** - Pinch-to-zoom on mobile, mouse wheel on desktop  
👁️ **Live Preview** - See exactly what will be printed  
📋 **Order Form** - Simple form to collect customer information  
💾 **Local Storage** - Orders saved locally on device  
🌐 **PWA Support** - Works offline with service worker  
🎨 **Beautiful UI** - Fun, professional, and easy to use  

## Tech Stack

- **Frontend**: React 18
- **Build Tool**: Vite
- **Image Cropping**: react-easy-crop
- **Styling**: CSS3 with Flexbox & Grid
- **Storage**: Browser localStorage
- **PWA**: Service Worker & Web App Manifest

## Pages

1. **Welcome Screen** - Introduction to the app
2. **Magnet Type Selection** - Choose Round or Rectangle
3. **Upload Photo** - Select image from device
4. **Adjust Photo** - Crop and position image with live preview
5. **Order Details** - Collect name, phone, email, quantity, and optional notes
6. **Review Order** - Verify magnet design and customer information
7. **Order Submitted** - Confirmation with order ID and next steps

## Getting Started

### Development

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:5173/`

### Build for Production

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
  ├── pages/          # Page components for each step
  ├── components/     # Reusable components
  ├── context/        # React Context for state management
  ├── utils/          # Helper functions for cropping
  ├── styles/         # CSS files for each page
  ├── App.jsx         # Main app component with routing
  ├── main.jsx        # Entry point with PWA setup
  └── index.css       # Global styles
public/
  ├── manifest.json   # PWA manifest
  └── service-worker.js # Service worker for offline support
```

## Key Features Explained

### Image Cropping with react-easy-crop

The `AdjustPhoto` page uses react-easy-crop to provide:
- **Circular crops** for round magnets
- **Rectangular crops** for rectangle magnets
- **Mouse wheel zoom** on desktop (1x to 3x)
- **Pinch-to-zoom** support on mobile devices
- **Drag to reposition** the image

### PWA Support

- **Manifest**: Installed as a native app on mobile devices
- **Service Worker**: Caches assets for offline access
- **App Icons**: SVG-based icons for all sizes
- **Standalone Mode**: Hides browser UI on mobile

### Local Storage

All orders are automatically saved to localStorage with complete information:
- **Current order**: In-progress magnet design
- **Order history**: All submitted orders
- **Email payload**: Ready-to-send email structure for Jennifer
- **Images**: Both original and final cropped images (base64)
- **Order metadata**: ID, timestamp, customer info, crop coordinates

Each stored order includes:
```javascript
{
  id: timestamp,
  submittedAt: "ISO datetime",
  magnetType: "round" or "rectangle",
  photo: base64,           // Original uploaded image
  croppedImage: base64,    // Final preview image
  customerInfo: {
    firstName: string,
    lastName: string,
    phone: string,
    email: string,
    quantity: number,
    notes: string
  },
  emailPayload: {...}      // Ready for Jennifer's email system
}
```

## Usage Workflow

1. User opens app and clicks "Get Started"
2. Selects magnet shape (Round or Rectangle)
3. Uploads a photo from their device
4. Uses intuitive controls to crop and position the photo
   - Drag to move the image
   - Scroll/pinch to zoom (1x to 3x)
   - Live preview shows exactly what will print
5. Clicks "Next" to generate final cropped image
6. Enters their information:
   - First Name
   - Last Name
   - Phone Number (validated)
   - Email Address (validated)
   - Quantity (1-100)
   - Optional notes for special requests
7. Reviews complete order with final magnet preview
8. Submits order with confirmation
9. Receives order ID and sees next steps
10. Can start designing another magnet

## Mobile Optimization

- Large touch-friendly buttons and inputs
- Optimized for small screens (mobile-first)
- Prevents iOS zoom on input focus
- Touch-friendly form controls
- Responsive preview boxes

## Browser Support

- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions (including iOS Safari)
- Mobile browsers with service worker support

## Color Scheme

- Primary: `#667eea` (Purple)
- Secondary: `#764ba2` (Dark Purple)
- Accent: `#00d2d3` (Cyan)
- Background: White
- Text: `#333` (Dark Gray)

## Future Enhancements

- [ ] Payment integration (Stripe, Square, etc.)
- [ ] Email notifications (SendGrid, Nodemailer)
- [ ] Supabase database integration
- [ ] Admin dashboard for Jennifer
- [ ] Customer SMS notifications
- [ ] Order tracking portal
- [ ] Image filters & effects
- [ ] Share designs with friends
- [ ] Batch order processing

## For Jennifer

### Email Payload System

Each submitted order includes an `emailPayload` object ready for integration:

**Current:** Orders are stored in browser localStorage with complete email structure
**Next Steps:** 
1. Set up email service (SendGrid, Nodemailer, AWS SES, etc.)
2. Connect to backend database (Supabase, Firebase, etc.)
3. Implement email sending on order submission
4. Set up customer contact workflow

**Email includes:**
- Customer name, phone, email
- Magnet type and quantity
- Optional customer notes
- Original uploaded image
- Final cropped image (ready to print)
- HTML and plain text versions
- Order ID for tracking

### Order Processing

Current workflow: Manual order processing
1. Customer submits order
2. Order data saved locally
3. Customer sees confirmation with Order ID
4. Manual next step: Jennifer accesses orders via browser storage
5. Jennifer contacts customer by phone to confirm and discuss payment

Future workflow: Automated email + database
1. Customer submits order
2. Email sent to Jennifer with all details
3. Database stores order
4. Jennifer dashboard shows pending orders
5. Status tracking and customer notifications

**To integrate:**
- Edit `emailPayload.to` field in `emailPayload.js` with actual email
- Add backend API endpoint to accept orders
- Connect email service to send on submission
- Build order management dashboard

## License

MIT
