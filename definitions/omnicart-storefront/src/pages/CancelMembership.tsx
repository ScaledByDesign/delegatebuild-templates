import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const CancelMembership = () => {
  return (
    <>
      <style>{`
        .cancel-page{--max:1180px;--gutter:48px;--gap:64px}
        .cancel-page *{box-sizing:border-box}

        .cancel-hero{
          background: linear-gradient(135deg,#2E1E87 0%,#0A86A9 100%);
          padding: 56px 16px 72px;
        }
        .cancel-hero__card{
          max-width: 960px; margin: 0 auto;
          background:#fff; border-radius:14px;
          padding: 32px 40px;
          box-shadow:0 8px 40px rgba(0,0,0,.08);
          text-align:center;
        }
        .cancel-title{
          font-size: 48px; line-height:1.15; letter-spacing:.02em;
          font-weight: 800; text-transform: uppercase;
          margin:0 0 16px;
          color:#111;
        }
        .cancel-intro{
          font-size: 23px !important; line-height:1.6; color:#4a4f56; margin:0;
          font-weight: 400;
        }

        .cancel-row{
          max-width: var(--max);
          margin: 56px auto;
          padding: 0 24px;
          display:grid; grid-template-columns: 1.2fr 1fr; gap: var(--gap);
          align-items: start;
        }
        .cancel-row--option2{ grid-template-columns: 1fr 1.2fr; }

        .cancel-row__media img{
          width:100%; height:auto; display:block;
          border-radius:16px; object-fit:cover; aspect-ratio:3/2;
          box-shadow:0 6px 28px rgba(0,0,0,.06);
        }

        .eyebrow{
          font-size:16px; letter-spacing:.12em; text-transform:uppercase;
          color:#7a8088; font-weight:700; margin:0 0 8px;
        }
        .cancel-h2{
          font-size: 42px; line-height:1.25; letter-spacing:.01em;
          font-weight: 800; text-transform: none;
          margin: 0 0 16px; color:#111;
        }

        .steps{ margin:0 0 24px; padding-left: 0; list-style: decimal; margin-left: 1.5rem; }
        .steps li{ font-size:18px; line-height:1.7; color:#3f454c; font-weight:400; margin: 10px 0; }
        .steps .step-label{ font-weight:400; color:#111; }

        .btn{ display:inline-block; text-align:center; text-decoration:none; cursor:pointer; user-select:none; }
        .btn-green{
          background:#16692F; color:#fff; border:0; border-radius:10px;
          padding: 14px 22px; min-width:144px;
          font-size:16px; letter-spacing:.06em; text-transform:uppercase; font-weight:700;
          box-shadow:0 4px 0 rgba(0,0,0,.12) inset;
          transition:filter .2s ease, transform .02s ease;
        }
        .btn-green:hover{ filter:brightness(0.92); }
        .btn-green:active{ transform: translateY(1px); }

        .cancel-page a{ text-decoration: underline; text-underline-offset:2px; }
        .cancel-page .btn{ text-decoration: none; }

        @media (max-width: 1080px){
          .cancel-title{ font-size:44px }
          .cancel-h2{ font-size:36px }
          .steps li{ font-size:17px }
          .cancel-row{ gap:40px }
        }
        @media (max-width: 860px){
          .cancel-hero{ padding:40px 16px 56px }
          .cancel-hero__card{ padding:24px 22px }
          .cancel-title{ font-size:34px }
          .cancel-intro{ font-size:19px !important }
          .cancel-row,
          .cancel-row--option2{ grid-template-columns: 1fr; }
          .cancel-row__media{ order: -1; }
          .btn-green{ width:100%; }
        }

        .cancel-page .reviews-tab{ z-index: 30 }
        .cancel-hero__card, .cancel-row__media img{ z-index: 1; position: relative }
      `}</style>
      
      <div className="min-h-screen flex flex-col">
        <Navbar />
        
        <main className="flex-grow">
          <section className="cancel-page">
            <div className="cancel-hero">
              <div className="cancel-hero__card">
                <h1 className="cancel-title">CANCEL TRN MEMBERSHIP</h1>
                <p className="cancel-intro">We're sorry to see you go, but we understand that circumstances change. If you've decided to cancel your subscription, we want to make the process as simple and straightforward as possible. Here are two convenient ways to cancel your subscription:</p>
              </div>
            </div>

            <section className="cancel-row cancel-row--option1">
              <div className="cancel-row__media">
                <img src="/cancel-laptop-option1.jpg" alt="Laptop showing TRN website" loading="lazy" />
              </div>
              <div className="cancel-row__content">
                <p className="eyebrow">OPTION 1</p>
                <h2 className="cancel-h2">LOGIN TO TRN WEBSITE</h2>
                <ol className="steps">
                  <li><span className="step-label">Log into Your Account:</span> Visit our website and log in using your credentials.</li>
                  <li><span className="step-label">Navigate to Cancel Membership:</span> Once logged in, click on the Cancel Membership in the menu.</li>
                  <li><span className="step-label">Cancel Membership:</span> Once you're in the cancel membership page, click on the "Cancel Membership" link. This will cancel your membership with us and you will be logged out.</li>
                  <li><span className="step-label">Confirmation:</span> After confirming your cancellation, you will receive an email confirmation to verify that your subscription has been successfully canceled.</li>
                </ol>
                <a className="btn btn-green" href="https://thereadynetwork.us/" target="_blank" rel="noopener noreferrer">LOGIN</a>
              </div>
            </section>

            <section className="cancel-row cancel-row--option2">
              <div className="cancel-row__content">
                <p className="eyebrow">OPTION 2</p>
                <h2 className="cancel-h2">CONTACT FORM</h2>
                <ol className="steps">
                  <li><span className="step-label">Contact Customer Support:</span> Reach out to our customer support team via the contact form here.</li>
                  <li><span className="step-label">Fill in the Cancellation Form:</span> Fill in the necessary details in our contact form for cancellation.</li>
                  <li><span className="step-label">Confirmation:</span> Once your request is processed, you will receive an email confirmation to let you know that your subscription has been canceled.</li>
                </ol>
                <a className="btn btn-green" href="/pages/trn-cancel-form" id="contact-form-btn">CONTACT FORM</a>
              </div>
              <div className="cancel-row__media">
                <img src="/cancel-desk-option2.jpg" alt="Laptop showing contact form" loading="lazy" />
              </div>
            </section>
          </section>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default CancelMembership;