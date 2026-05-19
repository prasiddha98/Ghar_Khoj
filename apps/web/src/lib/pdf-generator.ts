import html2pdf from "html2pdf.js";

interface ContractPDFGeneratorProps {
  contract: {
    id: number;
    tenant?: { firstName: string; lastName?: string };
    owner?: { firstName: string; lastName?: string };
    room?: { title: string; city: string; address: string };
    rentAmount: number;
    startDate: string;
    endDate: string;
    terms?: string;
    createdAt: string;
    ownerSignature?: string;
    tenantSignature?: string;
    ownerSignedAt?: string;
    tenantSignedAt?: string;
    status: string;
  };
}

export async function generateContractPDF(contract: ContractPDFGeneratorProps["contract"]): Promise<Blob> {
  const tenantName = contract.tenant
    ? `${contract.tenant.firstName} ${contract.tenant.lastName || ""}`.trim()
    : "Tenant";
  const ownerName = contract.owner
    ? `${contract.owner.firstName} ${contract.owner.lastName || ""}`.trim()
    : "Owner";
  const roomName = contract.room
    ? `${contract.room.title}, ${contract.room.city}`
    : "Room #" + contract.id;

  const tenantSigDisplay = contract.tenantSignature 
    ? (contract.tenantSignature.startsWith("data:image") 
      ? `<img src="${contract.tenantSignature}" style="max-width: 120px; max-height: 60px; border-bottom: 1px solid #333;" />` 
      : `<div style="border-bottom: 1px solid #333; padding: 5px 0; width: 200px;">${contract.tenantSignature}</div>`)
    : "<div style=\"border-bottom: 1px solid #999; padding: 5px 0; width: 200px;\"></div>";

  const ownerSigDisplay = contract.ownerSignature 
    ? (contract.ownerSignature.startsWith("data:image") 
      ? `<img src="${contract.ownerSignature}" style="max-width: 120px; max-height: 60px; border-bottom: 1px solid #333;" />` 
      : `<div style="border-bottom: 1px solid #333; padding: 5px 0; width: 200px;">${contract.ownerSignature}</div>`)
    : "<div style=\"border-bottom: 1px solid #999; padding: 5px 0; width: 200px;\"></div>";

  const contractDate = new Date(contract.createdAt).toLocaleDateString("en-NP");
  const currentDate = new Date().toLocaleDateString("en-NP");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: A4; margin: 20mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', 'Calibri', 'Arial', sans-serif; color: #222; background: #fff; }
        .container { width: 100%; max-width: 210mm; margin: 0 auto; padding: 16px 18px; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #0f3460; padding-bottom: 14px; margin-bottom: 22px; }
        .title-block { flex: 1; }
        .title-block h1 { font-size: 28px; letter-spacing: 0.5px; color: #0f3460; text-transform: uppercase; margin-bottom: 4px; }
        .title-block p { font-size: 12px; color: #4b5563; }
        .meta { font-size: 10px; color: #6b7280; margin-top: 8px; line-height: 1.6; }
        .logo { width: 92px; height: auto; object-fit: contain; }
        .section { margin-bottom: 18px; page-break-inside: avoid; }
        .section-title { display: inline-block; background: #0f3460; color: #fff; text-transform: uppercase; font-size: 11px; letter-spacing: 0.6px; padding: 8px 10px; border-radius: 999px; margin-bottom: 12px; }
        .grid-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
        .card { border: 1px solid #d1d5db; border-radius: 14px; padding: 16px; background: #f8fafc; }
        .card strong { display: block; margin-bottom: 6px; font-size: 11px; color: #0f3460; text-transform: uppercase; letter-spacing: 0.6px; }
        .card p { font-size: 12px; color: #111827; line-height: 1.6; }
        .info-row { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 10px; font-size: 11px; color: #374151; }
        .info-label { width: 38%; font-weight: 700; color: #111827; }
        .info-value { width: 62%; color: #1f2937; }
        .text-strong { font-weight: 700; color: #0f3460; }
        .terms-box { border: 1px solid #d1d5db; border-radius: 14px; padding: 16px; background: #ffffff; }
        .terms-box p, .terms-box li { font-size: 11px; line-height: 1.75; color: #334155; }
        .terms-list { list-style: none; padding-left: 0; margin-top: 0; }
        .terms-list li { position: relative; padding-left: 18px; margin-bottom: 10px; }
        .terms-list li:before { content: "\\2022"; color: #0f3460; position: absolute; left: 0; top: 0; font-size: 14px; line-height: 1; }
        .signature-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; margin-top: 10px; }
        .signature-block { border: 1px solid #d1d5db; border-radius: 14px; padding: 16px; min-height: 130px; background: #f8fafc; display: flex; flex-direction: column; justify-content: space-between; }
        .signature-box { min-height: 70px; display: flex; align-items: flex-end; justify-content: center; border-bottom: 1px solid #9ca3af; padding-bottom: 10px; }
        .signature-box img { max-width: 140px; max-height: 70px; object-fit: contain; }
        .footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 10px; color: #6b7280; text-align: center; line-height: 1.6; }
        .footer strong { color: #111827; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="title-block">
            <h1>RENTAL AGREEMENT</h1>
            <p>Property Rental Contract</p>
            <div class="meta">
              Contract ID: ${contract.id}<br />
              Created: ${contractDate}
            </div>
          </div>
          <img src="/images/chatgpt.png" alt="Ghar Khoj logo" class="logo" />
        </div>

        <div class="section">
          <span class="section-title">Parties to Agreement</span>
          <div class="grid-2">
            <div class="card">
              <strong>Tenant</strong>
              <p class="text-strong">${tenantName}</p>
              <p>Tenant / Renter</p>
            </div>
            <div class="card">
              <strong>Owner / Landlord</strong>
              <p class="text-strong">${ownerName}</p>
              <p>Property Owner / Landlord</p>
            </div>
          </div>
        </div>

        <div class="section">
          <span class="section-title">Property Details</span>
          <div class="terms-box">
            <div class="info-row">
              <div class="info-label">Property Name</div>
              <div class="info-value text-strong">${contract.room?.title || 'N/A'}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Location</div>
              <div class="info-value text-strong">${contract.room?.city || 'N/A'}${contract.room?.address ? ', ' + contract.room.address : ''}</div>
            </div>
          </div>
        </div>

        <div class="section">
          <span class="section-title">Financial Terms</span>
          <div class="terms-box">
            <div class="info-row">
              <div class="info-label">Monthly Rent</div>
              <div class="info-value text-strong">NPR ${contract.rentAmount.toLocaleString()}</div>
            </div>
            <div class="info-row">
              <div class="info-label">Payment Frequency</div>
              <div class="info-value">Monthly, payable by the 1st</div>
            </div>
          </div>
        </div>

        <div class="section">
          <span class="section-title">Term of Lease</span>
          <div class="terms-box">
            <div class="info-row">
              <div class="info-label">Start Date</div>
              <div class="info-value text-strong">${contract.startDate}</div>
            </div>
            <div class="info-row">
              <div class="info-label">End Date</div>
              <div class="info-value text-strong">${contract.endDate}</div>
            </div>
          </div>
        </div>

        ${contract.terms ? `
        <div class="section">
          <span class="section-title">Special Terms & Conditions</span>
          <div class="terms-box">
            <p>${contract.terms.split('\n').join('<br/>')}</p>
          </div>
        </div>
        ` : ''}

        <div class="section">
          <span class="section-title">Standard Terms</span>
          <div class="terms-box">
            <ul class="terms-list">
              <li>Rent is payable monthly and due by the first calendar day of each month.</li>
              <li>The tenant is responsible for routine upkeep and maintaining the property in good condition.</li>
              <li>A security deposit of one month’s rent will be retained by the owner and returned after satisfactory inspection.</li>
              <li>Either party may terminate this agreement with 30 days written notice.</li>
              <li>Utilities are payable by the tenant unless otherwise agreed in writing.</li>
              <li>This agreement is governed by the laws of Nepal.</li>
            </ul>
          </div>
        </div>

        <div class="section">
          <span class="section-title">Digital Signatures</span>
          <div class="signature-grid">
            <div class="signature-block">
              <div>
                <div class="signature-title">Tenant Signature</div>
                <div class="signature-box">${contract.tenantSignature ? (contract.tenantSignature.startsWith('data:image') ? '<img src="' + contract.tenantSignature + '" />' : '<div class="text-strong">' + contract.tenantSignature + '</div>') : '<div></div>'}</div>
              </div>
              <div>
                <p class="text-strong">${tenantName}</p>
                <p style="font-size:10px;color:#6b7280;">Date: ${contract.tenantSignedAt ? new Date(contract.tenantSignedAt).toLocaleDateString('en-NP') : currentDate}</p>
              </div>
            </div>
            <div class="signature-block">
              <div>
                <div class="signature-title">Owner Signature</div>
                <div class="signature-box">${contract.ownerSignature ? (contract.ownerSignature.startsWith('data:image') ? '<img src="' + contract.ownerSignature + '" />' : '<div class="text-strong">' + contract.ownerSignature + '</div>') : '<div></div>'}</div>
              </div>
              <div>
                <p class="text-strong">${ownerName}</p>
                <p style="font-size:10px;color:#6b7280;">Date: ${contract.ownerSignedAt ? new Date(contract.ownerSignedAt).toLocaleDateString('en-NP') : currentDate}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="footer">
          <strong>Ghar Khoj - Room Rental Nepal</strong><br />
          Official Rental Agreement Contract<br />
          Generated on ${new Date().toLocaleDateString('en-NP')}
        </div>
      </div>
    </body>
    </html>
  `;

  return new Promise((resolve, reject) => {
    const element = document.createElement("div");
    element.innerHTML = htmlContent;
    
    const options = {
      margin: [10, 10, 10, 10],
      filename: `contract-${contract.id}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: "portrait", unit: "mm", format: "a4" },
    };

    html2pdf()
      .set(options)
      .from(element)
      .outputPdf("blob")
      .then((blob: Blob) => resolve(blob))
      .catch((err: Error) => reject(err));
  });
}
