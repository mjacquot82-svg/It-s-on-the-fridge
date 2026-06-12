# Testing Guide - Order Workflow

## Quick Test Walkthrough

### Prerequisites
- App running at http://localhost:5173/
- Browser DevTools open (F12)

### Test Scenario 1: Complete Happy Path

**Step 1: Welcome Screen**
- ✅ Click "Get Started"
- ✅ Progress bar shows ~14% (page 1 of 7)

**Step 2: Magnet Type Selection**
- ✅ See two options: Round and Rectangle
- ✅ Click "Round Magnet"
- ✅ Progress bar advances to ~28%

**Step 3: Upload Photo**
- ✅ Click "Choose Photo"
- ✅ Select any image from your device
- ✅ Progress bar advances to ~42%

**Step 4: Adjust Photo** 
- ✅ See circular crop preview
- ✅ Drag image to reposition
- ✅ Scroll to zoom (should show zoom % on slider)
- ✅ Live preview box shows exactly what will print
- ✅ Warning message visible: "Everything visible inside the preview will be printed"
- ✅ Click "Next"
- ✅ Progress bar advances to ~57%

**Step 5: Order Details** (NEW)
- ✅ Form with fields: First Name, Last Name, Phone, Email, Quantity, Notes
- ✅ Try to submit empty → See required field errors
- ✅ Enter: 
  - First Name: John
  - Last Name: Doe
  - Phone: (555) 123-4567
  - Email: john@example.com
  - Quantity: 2 (use +/- buttons)
  - Notes: "Make it special!" (optional)
- ✅ All fields turn green (valid)
- ✅ Click "Review Order"
- ✅ Progress bar advances to ~71%

**Step 6: Review Order** (UPDATED)
- ✅ See final magnet preview image
- ✅ Message says: "This preview represents what will be printed"
- ✅ Summary shows:
  - Name: John Doe
  - Phone: (555) 123-4567
  - Email: john@example.com
  - Quantity: 2
  - Notes: Make it special! (visible because it was filled)
  - Magnet Type: Round Magnet
- ✅ Back button works → returns to Order Details with data preserved
- ✅ Submit Order button
- ✅ Progress bar advances to ~85%

**Step 7: Order Submitted** (UPDATED)
- ✅ Success checkmark animation plays
- ✅ Title: "Thank You for Your Order!"
- ✅ Message: "We'll contact you soon regarding pickup and payment."
- ✅ Order Summary shows:
  - Order ID (timestamp number)
  - Name: John Doe
  - Phone, Email
  - Magnet Type: Round Magnet
  - Quantity: 2
  - Notes: Make it special!
- ✅ Next Steps section explains Jennifer will contact them
- ✅ Click "Design Another Magnet"
- ✅ Progress bar reset, back at Welcome

### Test Scenario 2: Form Validation

**Email Validation**
- Try "invalidemail" → Error: "Enter a valid email"
- Try "invalid@" → Error
- Try "valid@example.com" → No error ✅

**Phone Validation**
- Try "123" → Error: "Enter a valid phone number"
- Try "555-123-4567" → No error ✅
- Try "(555) 123-4567" → No error ✅
- Try "+1 555 123 4567" → No error ✅

**Quantity Validation**
- Try "0" → Should not allow (min is 1)
- Try "100" → Should allow
- Try "101" → Should allow (up to 100 in UI, but no hard limit)
- Use +/- buttons → Should increment/decrement

### Test Scenario 3: Back Navigation

From Review Order page:
- Click "Back"
- Should return to Order Details
- All entered data should be preserved ✅
- Edit first name, click "Review Order"
- Should show updated first name ✅

### Test Scenario 4: Rectangle Magnet

Repeat same flow but:
- Select "Rectangle Magnet" on Step 2
- On Adjust Photo: Should see rectangular crop instead of circular ✅
- On Review: Should show rectangular preview ✅
- Summary should show "Rectangle Magnet" ✅

### Test Scenario 5: Optional Notes

- Fill form normally
- Leave Notes empty
- On Review Order: Notes section should NOT appear ✅
- Submit and verify ✅

With Notes:
- Fill form with notes: "Please use glossy finish"
- On Review Order: Notes section should appear ✅
- Verify text matches

## Browser Storage Testing

### Check localStorage

Open DevTools → Application tab → Local Storage

**currentOrder (in progress design)**
```
{
  magnetType: "round",
  photo: "data:image/png;base64,...",
  crop: {x: 0, y: 0},
  zoom: 1,
  croppedImage: "data:image/png;base64,...",
  customerInfo: {
    firstName: "John",
    lastName: "Doe",
    phone: "(555) 123-4567",
    email: "john@example.com",
    quantity: 2,
    notes: "Make it special!"
  }
}
```

**orders (completed orders)**
```
[
  {
    id: 1718189732486,
    submittedAt: "2026-06-12T...",
    magnetType: "round",
    photo: "data:image/png;base64,...",
    croppedImage: "data:image/png;base64,...",
    customerInfo: {...},
    emailPayload: {
      to: "jennifer@example.com",
      subject: "New Magnet Order - John Doe",
      orderId: 1718189732486,
      customer: {...},
      product: {...},
      images: {...},
      htmlContent: "...",
      textContent: "..."
    }
  }
]
```

## Console Testing

### Check Email Payload

In browser console (F12):
```javascript
// Get all orders
const orders = JSON.parse(localStorage.getItem('orders'));
console.log(orders[0].emailPayload);

// Should show complete structure with:
// - to, subject, orderId, orderDate
// - customer info (firstName, lastName, phone, email, notes)
// - product (type, displayType, quantity)
// - images (original, cropped with base64 data)
// - cropDetails (coordinates, zoom, magnetType)
// - htmlContent and textContent
```

### Verify Image Quality

```javascript
const orders = JSON.parse(localStorage.getItem('orders'));
const croppedImage = orders[0].croppedImage;
console.log('Cropped image size:', croppedImage.length, 'bytes');
// Should be several MB in base64 format
```

## Mobile Testing

### Pinch to Zoom
- On physical device or Chrome DevTools device emulation
- On Adjust Photo page
- Place two fingers on screen
- Pinch out to zoom in ✅
- Pinch in to zoom out ✅
- Should work from 1x to 3x

### Touch Interactions
- Drag image to reposition ✅
- Tap +/- buttons for quantity ✅
- All buttons should be large enough (44x44px minimum)
- No text should be cut off

## Responsive Testing

### Desktop (1920x1080)
- All form fields visible
- Two-column layout for First Name / Last Name ✅
- Preview box centered and visible ✅

### Tablet (768x1024)
- All fields visible, slightly smaller
- Two-column layout may reduce or stack ✅
- Everything touch-friendly ✅

### Mobile (375x667)
- First Name / Last Name stack vertically ✅
- Form fields full width ✅
- Buttons full width ✅
- Preview box sized appropriately ✅

## Performance Testing

### Initial Load
- Should load in under 3 seconds
- No console errors ✅

### Image Upload
- Upload large image (5MB+)
- Should handle without freezing ✅
- Crop generation should be fast

### Storage Growth
- Submit 5 orders
- Check localStorage doesn't exceed browser limits ✅
- (Most browsers allow 5-10MB per domain)

## Error Testing

### Network Issues
- Service Worker should cache the app ✅
- Offline mode should still work ✅
- Try offline in DevTools → Network tab → Set to "Offline"
- Should still load and function

### Invalid Data
- Manually corrupt localStorage (DevTools)
- App should gracefully handle or reset ✅

## Visual Testing Checklist

- [ ] Welcome screen has floating logo animation
- [ ] Magnet type cards show preview shapes
- [ ] Upload screen has bouncing camera icon
- [ ] Adjust screen has grid overlay on cropper
- [ ] Form fields have proper focus states (blue border)
- [ ] Error messages appear in red
- [ ] Success screen has checkmark animation
- [ ] Progress bar smoothly animates
- [ ] All buttons have hover effects
- [ ] Links/buttons have adequate contrast (WCAG AA)
- [ ] No layout shifts when loading
- [ ] Smooth page transitions (slideUp animation)

## Expected Data Flow

```
Welcome 
  ↓
Magnet Type → magnetType: 'round'
  ↓
Upload Photo → photo: base64
  ↓
Adjust Photo → crop: {x,y}, zoom: number, croppedImage: base64
  ↓
Order Details → customerInfo: {firstName, lastName, phone, email, quantity, notes}
  ↓
Review Order → Display all data, option to go back
  ↓
Order Submitted → Create order object, generate emailPayload, store in localStorage
  ↓
Success → Show confirmation with Order ID
```

## Debugging Tips

### If form validation seems broken:
1. Check phone regex: `/^\d{10,}$/` (after removing non-digits)
2. Check email regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
3. Check field names match (firstName, lastName, not name)

### If back button doesn't work:
1. Check onBack prop passed to ReviewOrder ✅
2. Check handleBack function in App.jsx ✅
3. Verify navigation index is decremented correctly

### If images not showing:
1. Check croppedImage is being set in AdjustPhoto
2. Check image URLs are valid base64 strings
3. Check they're not getting cleared on navigation

### If localStorage not persisting:
1. Check browser allows localStorage (not in private/incognito)
2. Check storage quota not exceeded
3. Check JSON stringification is correct

## Success Criteria

All tests pass when:
- ✅ All 7 pages render correctly
- ✅ Form validation works as expected
- ✅ Back navigation preserves data
- ✅ Email payload structure is complete
- ✅ Final image matches preview
- ✅ Orders persist in localStorage
- ✅ Mobile responsive on all screen sizes
- ✅ No console errors
- ✅ PWA works offline
- ✅ UI is fast and smooth
