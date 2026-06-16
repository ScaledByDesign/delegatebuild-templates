
import React, { useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const About = () => {
  useEffect(() => {
    // Load Vidalytics video player script
    const script = document.createElement('script');
    script.innerHTML = `
      (function (v, i, d, a, l, y, t, c, s) {
        y='_'+d.toLowerCase();c=d+'L';if(!v[d]){v[d]={};}if(!v[c]){v[c]={};}if(!v[y]){v[y]={};}var vl='Loader',vli=v[y][vl],vsl=v[c][vl + 'Script'],vlf=v[c][vl + 'Loaded'],ve='Embed';
        if (!vsl){vsl=function(u,cb){
            if(t){cb();return;}s=i.createElement("script");s.type="text/javascript";s.async=1;s.src=u;
            if(s.readyState){s.onreadystatechange=function(){if(s.readyState==="loaded"||s.readyState=="complete"){s.onreadystatechange=null;vlf=1;cb();}};}else{s.onload=function(){vlf=1;cb();};}
            i.getElementsByTagName("head")[0].appendChild(s);
        };}
        vsl(l+'loader.min.js',function(){if(!vli){var vlc=v[c][vl];vli=new vlc();}vli.loadScript(l+'player.min.js',function(){var vec=v[d][ve];t=new vec();t.run(a);});});
      })(window, document, 'Vidalytics', 'vidalytics_embed_ts4P85AQNtam39oG', 'https://quick.vidalytics.com/embeds/IgKBDqAD/ts4P85AQNtam39oG/');
    `;
    document.body.appendChild(script);

    return () => {
      // Cleanup script on unmount
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-grow">
        {/* Page Heading */}
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold text-center mb-12 uppercase">About Us</h1>

          {/* Video Section - Vidalytics Player */}
          <div className="max-w-3xl mx-auto mb-16">
            <div id="vidalytics_embed_ts4P85AQNtam39oG" style={{ width: '100%', position: 'relative', paddingTop: '56.25%' }}></div>
          </div>

          {/* Who is VNSH? Section */}
          <div className="max-w-3xl mx-auto mb-16">
            <h2 className="text-2xl font-bold mb-6 uppercase">Who Is VNSH?</h2>
            <div className="space-y-5 opacity-75">
              <p className="text-lg">
                Millions upon millions of Americans own and carry guns for self-protection. VNSH brands builds the most comfortable and most versatile holsters on the market so those wishing to carry daily never have a reason not to carry.
              </p>
              <p className="text-lg">
                Additionally, VNSH provides supplemental products that allow for the daily carry of other self-defense tools; as well as products that ensure VNSH customers can confidently use their weapons and to save their life without engaging others.
              </p>
            </div>
          </div>

          {/* Who do we serve? Section */}
          <div className="max-w-3xl mx-auto mb-16">
            <h2 className="text-2xl font-bold mb-6 uppercase">Who Do We Serve?</h2>
            <div className="space-y-5 opacity-75">
              <p className="text-lg">
                We serve every American who wants to prepare for the worst <em>without spending an arm and a leg</em> to do it.
              </p>
              <p className="text-lg">
                VNSH is for Americans who see the direction our country is headed… who <em>know it's time</em> to get their families ready… but don't want to waste any time or money to do it.
              </p>
            </div>
          </div>

          {/* Got more questions? Section */}
          <div className="max-w-3xl mx-auto mb-16">
            <h2 className="text-2xl font-bold mb-6 uppercase">Got More Questions?</h2>
            <div className="space-y-5 opacity-75">
              <p className="text-lg">
                We're always available to answer any questions or concerns you may have.
              </p>
              <p className="text-lg">
                Just call us here: <strong>1-888-526-1885</strong> (VNSH).
              </p>
              <p className="text-lg">
                You'll instantly get to speak with a <strong>real American</strong>. NO ROBOTS.
              </p>
              <p className="text-lg">
                You can also email us any time at: <strong>customercare@vnsh.com</strong>
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default About;
