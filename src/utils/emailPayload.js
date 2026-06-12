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
        description: 'Original uploaded image by customer',
      },
      cropped: {
        data: order.croppedImage,
        description: 'Final cropped image ready for printing',
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
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; }
    .section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 8px; }
    .label { font-weight: bold; color: #667eea; }
    .image-preview { max-width: 300px; border: 2px solid #667eea; border-radius: 8px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🧲 New Magnet Order Received</h1>
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
      <h2>Final Magnet Preview</h2>
      <p>This is exactly what the customer will receive:</p>
      <img src="cid:cropped-image" alt="Final Magnet Preview" class="image-preview" />
    </div>
    
    <div class="section" style="background: #fff3cd; border-left: 4px solid #ffc107;">
      <h3 style="color: #856404;">Next Steps</h3>
      <ul>
        <li>Contact customer to confirm details</li>
        <li>Discuss payment options</li>
        <li>Schedule pickup time</li>
        <li>Print the magnet using the final preview image</li>
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
NEW MAGNET ORDER RECEIVED

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

Final Magnet Preview:
The cropped image is attached and ready for printing.

Next Steps:
1. Contact customer to confirm details
2. Discuss payment options
3. Schedule pickup time
4. Print the magnet using the final preview image
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
