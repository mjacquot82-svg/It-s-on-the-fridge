import { getMagnetTypeLabel, normalizeCustomDesigns } from './customDesigns';

/**
 * Creates an email payload structure for sending order details to Jennifer
 * @param {Object} order - The complete order object
 * @returns {Object} Email payload with all necessary information
 */
export function createEmailPayload(order) {
  const designs = normalizeCustomDesigns(order);
  const totalQuantity = designs.reduce((total, design) => total + (Number(design.quantity) || 0), 0);

  return {
    to: 'jennifer@example.com',
    subject: `New Magnet Order - ${order.customerInfo.firstName} ${order.customerInfo.lastName}`,
    orderId: order.id,
    orderDate: order.submittedAt,
    customer: {
      firstName: order.customerInfo.firstName,
      lastName: order.customerInfo.lastName,
      fullName: `${order.customerInfo.firstName} ${order.customerInfo.lastName}`,
      phone: order.customerInfo.phone,
      email: order.customerInfo.email,
      notes: order.customerInfo.notes || 'None',
    },
    product: {
      type: designs[0]?.magnetType || order.magnetType,
      displayType: getMagnetTypeLabel(designs[0]?.magnetType || order.magnetType),
      quantity: totalQuantity || order.customerInfo.quantity,
      designCount: designs.length || 1,
    },
    designs: designs.map((design, index) => ({
      index: index + 1,
      type: design.magnetType,
      displayType: getMagnetTypeLabel(design.magnetType),
      quantity: design.quantity,
    })),
    images: {
      original: {
        data: designs[0]?.photo || order.photo,
        description: 'Original Customer Photo',
      },
      cropped: {
        data: designs[0]?.croppedImage || order.croppedImage,
        description: 'Print-Ready Magnet Image',
      },
    },
    cropDetails: {
      coordinates: {
        x: designs[0]?.crop?.x ?? order.crop?.x,
        y: designs[0]?.crop?.y ?? order.crop?.y,
      },
      zoom: designs[0]?.zoom ?? order.zoom,
      magnetType: designs[0]?.magnetType || order.magnetType,
      designCount: designs.length || 1,
    },
    htmlContent: generateEmailHTML(order, designs, totalQuantity),
    textContent: generateEmailText(order, designs, totalQuantity),
  };
}

function generateEmailHTML(order, designs, totalQuantity) {
  const customerName = `${order.customerInfo.firstName} ${order.customerInfo.lastName}`;
  const designRows = designs.map((design, index) => `
      <p><span class="label">Magnet ${index + 1}:</span> ${getMagnetTypeLabel(design.magnetType)} × ${design.quantity}</p>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 4px solid #63c7bd; padding: 0 0 16px; margin-bottom: 20px; }
    .section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 8px; }
    .label { font-weight: bold; color: #0b3048; }
    .image-preview { max-width: 300px; border: 2px solid #0b3048; border-radius: 8px; margin: 10px 0; }
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
      ${designRows || `<p><span class="label">Magnet Type:</span> ${getMagnetTypeLabel(order.magnetType)}</p>
      <p><span class="label">Quantity:</span> ${order.customerInfo.quantity}</p>`}
      <p><span class="label">Total Magnets:</span> ${totalQuantity || order.customerInfo.quantity}</p>
    </div>

    <div class="section">
      <h2>Attached Images</h2>
      <p>Each magnet design includes an original customer photo and a print-ready cropped image.</p>
    </div>

    <div class="section next-steps">
      <h3>Next Steps</h3>
      <ul>
        <li>Jennifer will contact the customer to confirm details</li>
        <li>Confirm pickup and payment</li>
        <li>Print each magnet using its print-ready image</li>
      </ul>
    </div>
  </div>
</body>
</html>
  `;
}

function generateEmailText(order, designs, totalQuantity) {
  const customerName = `${order.customerInfo.firstName} ${order.customerInfo.lastName}`;
  const orderDate = new Date(order.submittedAt).toLocaleString();
  const designLines = designs.map((design, index) => (
    `- Magnet ${index + 1}: ${getMagnetTypeLabel(design.magnetType)} x ${design.quantity}`
  ));

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
${designLines.length ? designLines.join('\n') : `- Magnet Type: ${getMagnetTypeLabel(order.magnetType)}\n- Quantity: ${order.customerInfo.quantity}`}
- Total Magnets: ${totalQuantity || order.customerInfo.quantity}

Attached Images:
- Each design includes an original customer photo and a print-ready magnet image.

Next Steps:
1. Jennifer will contact the customer to confirm details
2. Confirm pickup and payment
3. Print each magnet using its print-ready image
  `;
}

export function exportOrderAsJSON(order) {
  const designs = normalizeCustomDesigns(order);
  return JSON.stringify({
    id: order.id,
    submittedAt: order.submittedAt,
    customer: {
      firstName: order.customerInfo.firstName,
      lastName: order.customerInfo.lastName,
      phone: order.customerInfo.phone,
      email: order.customerInfo.email,
      notes: order.customerInfo.notes,
    },
    designs: designs.map(design => ({
      magnetType: design.magnetType,
      quantity: design.quantity,
      cropCoordinates: design.crop,
      zoom: design.zoom,
    })),
    totalQuantity: designs.reduce((total, design) => total + (Number(design.quantity) || 0), 0),
  }, null, 2);
}
