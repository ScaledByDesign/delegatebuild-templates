const MEMORIAL_DAY_START = new Date('2026-05-22T00:00:00-05:00'); // midnight CDT May 22
const MEMORIAL_DAY_END = new Date('2026-05-26T09:00:00-05:00');   // 9am CDT Tuesday May 26

function isMemorialDaySale() {
  const now = new Date();
  return now >= MEMORIAL_DAY_START && now < MEMORIAL_DAY_END;
}

export default function AnnouncementBars() {
  const showMemorialDay = isMemorialDaySale();

  if (showMemorialDay) {
    return (
      <div
        id="vnsh-annc-memorial"
        style={{
          position: 'relative',
          background: '#080e1c',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '10px 16px',
          width: '100%',
          boxSizing: 'border-box',
          overflow: 'hidden',
          minHeight: '56px',
        }}
      >
        {/* background image — extends past right edge so overflow:hidden crops it */}
        <div style={{
          position: 'absolute',
          top: 0, bottom: 0, left: 0,
          right: '-8%',
          backgroundImage: 'url(/images/memorial-day-banner.png)',
          backgroundSize: '100% 100%',
        }} />
        {/* dark center overlay for text legibility */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, transparent 0%, rgba(5,10,25,0.55) 30%, rgba(5,10,25,0.55) 70%, transparent 100%)',
        }} />
        <div style={{ position: 'relative', zIndex: 1, lineHeight: 1.4 }}>
          <div style={{ fontWeight: 900, fontSize: '18px', letterSpacing: '0.5px', textTransform: 'capitalize' }}>
            Memorial Day Sale – 20% OFF Sitewide&nbsp;&nbsp;|&nbsp;&nbsp;Use Code: MEMORIAL20
          </div>
          <div style={{ fontWeight: 900, fontSize: '17px', marginTop: '3px', letterSpacing: '0.5px', textTransform: 'capitalize' }}>
            FREE Shipping over $50
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ORANGE bar (white text) - HIDDEN */}
      {/* <div id="vnsh-annc-orange" className="announcement-bar--orange w-full bg-[#F39800] flex items-center justify-center text-center px-3">
        <span>
          New Product: Weapon Mounted Light Compatible Holster Now Available —{' '}
          <a href="/products/the-vnsh-holster-weapon-mounted-light-compatible" className="underline hover:no-underline">Buy Now and Get 2 FREE Gifts</a>
        </span>
      </div> */}

      {/* BLACK bar (shorter) */}
      <div
        id="vnsh-annc-black"
        className="announcement-bar--black"
        style={{
          background: '#000',
          color: '#fff',
          height: '36px',
          minHeight: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          margin: 0,
          padding: '0 12px',
          boxSizing: 'border-box',
          width: '100%'
        }}
      >
        🔥 Welcome to our store. Free shipping over $50. 🔥
      </div>
    </>
  );
}

// Also exported as a named export so either import style resolves
// (`import AnnouncementBars from ...` or `import { AnnouncementBars } from ...`).
export { AnnouncementBars };
