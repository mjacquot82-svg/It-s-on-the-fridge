/**
 * Creates an email payload structure for sending order details to Jennifer
 * @param {Object} order - The complete order object
 * @returns {Object} Email payload with all necessary information
 */
export function createEmailPayload(order) {
  return {
    // Email metadata
    to: 'jennifer@example.com', // Will be replaced with actual email
    subject: `New Magnet Order - ${order.customerInfo.firstName} ${order.customerInfo.lastName}`,
    
    // Order identification
    orderId: order.id,
    orderDate: order.submittedAt,
    
    // Customer information
    customer: {
      firstName: order.customerInfo.firstName,
      lastName: order.customerInfo.lastName,
      fullName: `${order.customerInfo.firstName} ${order.customerInfo.lastName}`,
      phone: order.customerInfo.phone,
      email: order.customerInfo.email,
      notes: order.customerInfo.notes || 'None',
    },
    
    // Product information
    product: {
      type: order.magnetType,
      displayType: order.magnetType === 'round' ? 'Round Magnet' : 'Rectangle Magnet',
      quantity: order.customerInfo.quantity,
    },
    
    // Image data
    images: {
      original: {
        data: order.photo,
        description: 'Original Customer Photo',
      },
      cropped: {
        data: order.croppedImage,
        description: 'Print-Ready Magnet Image',
      },
    },
    
    // Crop information (for reference)
    cropDetails: {
      coordinates: {
        x: order.crop.x,
        y: order.crop.y,
      },
      zoom: order.zoom,
      magnetType: order.magnetType,
    },
    
    // HTML Email template
    htmlContent: generateEmailHTML(order),
    
    // Plain text version
    textContent: generateEmailText(order),
  };
}

/**
 * Generate HTML email content
 */
function generateEmailHTML(order) {
  const customerName = `${order.customerInfo.firstName} ${order.customerInfo.lastName}`;
  const magnetType = order.magnetType === 'round' ? 'Round Magnet' : 'Rectangle Magnet';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 4px solid #667eea; padding: 0 0 16px; margin-bottom: 20px; }
    .section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 8px; }
    .label { font-weight: bold; color: #667eea; }
    .image-preview { max-width: 300px; border: 2px solid #667eea; border-radius: 8px; margin: 10px 0; }
    .next-steps { background: #fffdf7; border-left: 4px solid #d9bf72; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>It's On The Fridge</h1>
      <p>New custom magnet order</p>
    </div>
    
    <div class="section">
      <h2>Order Information</h2>
      <p><span class="label">Order ID:</span> ${order.id}</p>
      <p><span class="label">Order Date:</span> ${new Date(order.submittedAt).toLocaleString()}</p>
    </div>
    
    <div class="section">
      <h2>Customer Details</h2>
      <p><span class="label">Name:</span> ${customerName}</p>
      <p><span class="label">Phone:</span> ${order.customerInfo.phone}</p>
      <p><span class="label">Email:</span> ${order.customerInfo.email}</p>
      ${order.customerInfo.notes ? `<p><span class="label">Notes:</span> ${order.customerInfo.notes}</p>` : ''}
    </div>
    
    <div class="section">
      <h2>Product Details</h2>
      <p><span class="label">Magnet Type:</span> ${magnetType}</p>
      <p><span class="label">Quantity:</span> ${order.customerInfo.quantity}</p>
    </div>
    
    <div class="section">
      <h2>Attached Images</h2>
      <p><strong>Original Customer Photo:</strong> the photo the customer uploaded.</p>
      <p><strong>Print-Ready Magnet Image:</strong> the cropped image Jennifer should use for printing.</p>
      <img src="cid:cropped-image" alt="Final Magnet Preview" class="image-preview" />
    </div>
    
    <div class="section next-steps">
      <h3>Next Steps</h3>
      <ul>
        <li>Jennifer will contact the customer to confirm details</li>
        <li>Confirm pickup and payment</li>
        <li>Print the magnet using the print-ready image</li>
      </ul>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generate plain text email content
 */
function generateEmailText(order) {
  const customerName = `${order.customerInfo.firstName} ${order.customerInfo.lastName}`;
  const magnetType = order.magnetType === 'round' ? 'Round Magnet' : 'Rectangle Magnet';
  const orderDate = new Date(order.submittedAt).toLocaleString();
  
  return `
IT'S ON THE FRIDGE
New custom magnet order

Order Information:
- Order ID: ${order.id}
- Order Date: ${orderDate}

Customer Details:
- Name: ${customerName}
- Phone: ${order.customerInfo.phone}
- Email: ${order.customerInfo.email}
${order.customerInfo.notes ? `- Notes: ${order.customerInfo.notes}` : ''}

Product Details:
- Magnet Type: ${magnetType}
- Quantity: ${order.customerInfo.quantity}

Attached Images:
- Original Customer Photo: the photo the customer uploaded.
- Print-Ready Magnet Image: the cropped image Jennifer should use for printing.

Next Steps:
1. Jennifer will contact the customer to confirm details
2. Confirm pickup and payment
3. Print the magnet using the print-ready image
  `;
}

/**
 * Export order data as JSON for storage or debugging
 */
export function exportOrderAsJSON(order) {
  return JSON.stringify({
    id: order.id,
    submittedAt: order.submittedAt,
    magnetType: order.magnetType,
    customer: {
      firstName: order.customerInfo.firstName,
      lastName: order.customerInfo.lastName,
      phone: order.customerInfo.phone,
      email: order.customerInfo.email,
      notes: order.customerInfo.notes,
    },
    quantity: order.customerInfo.quantity,
    cropCoordinates: order.crop,
    zoom: order.zoom,
  }, null, 2);
}
