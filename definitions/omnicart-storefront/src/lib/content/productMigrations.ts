/**
 * Migration Data: Convert hardcoded STATIC_CONTENT to custom PDP sections
 *
 * This file contains the metadata structure needed to migrate products from
 * hardcoded STATIC_CONTENT to Admin-managed custom PDP sections.
 *
 * Each product should be created in Admin with these sections, in this order.
 * Then STATIC_CONTENT entries can be removed from productContent.ts
 */

export interface PDPSectionData {
  type: 'image_with_text' | 'video' | 'html';
  title?: string;
  body_html?: string;
  image?: string;
  align?: 'left' | 'right';
  url?: string;
  html?: string;
}

export const productMigrations: Record<string, {
  productHandle: string;
  description: string;
  sections: PDPSectionData[];
}> = {
  "vnsh-holster": {
    productHandle: "vnsh-holster",
    description: "VNSH Holster - Migrate 3 features + 8 FAQ items to custom sections",
    sections: [
      // Feature 1
      {
        type: 'image_with_text',
        title: 'We Engineered This Holster to Feel "Like it Ain\'t Even There"',
        body_html: '<p>We made the VNSH holster from premium material to ensure this holster is the most comfortable one you\'ve ever worn. From stretchy "yoga pants" fabric on the inside of the belt, ultra-soft but durable Cordura nylon for the holster itself, and non poke, non binding velcro on the 3.5" belt this holster comfortably clings to your body, holding your gun and 2 mags secure while you go throughout your day. Plus, the VNSH holster pulls the holster close to your body so it makes the holster "vanish" while you wear it.</p>',
        image: '/images/products/DSC01875-1.png',
        align: 'left',
      },
      // Feature 2
      {
        type: 'image_with_text',
        title: 'Works With 99% of Modern Handguns',
        body_html: '<p>Our custom-designed holster design means that regardless of what pistol you own... it will help you safely and comfortably carry it. No more needing to buy multiple holsters for all your pistols. Plus, since it has 2-built in mag pouches, now you don\'t need to spend extra money on mag pouches to guarantee you\'re never out of the fight.</p>',
        image: '/images/products/compatible-brands.jpg',
        align: 'right',
      },
      // Feature 3
      {
        type: 'image_with_text',
        title: 'Multiple Carry Options',
        body_html: '<p>Not a standard bellyband. Carry in multiple ways: Appendix, shoulder, small of back, 3 o\'clock. Your options are varied.</p><p>VNSH Holsters Save You Money! Because the VNSH holster works with 99% of modern semi-automatic handguns it is the best holster to own as you won\'t need multiple holsters. 1 holster does it all - and saves you money in the process.</p>',
        image: '/images/products/VNSH-Holster-r2-opt.gif',
        align: 'left',
      },
    ],
  },

  "vnsh-laser-strike-enhanced-training-system": {
    productHandle: "vnsh-laser-strike-enhanced-training-system",
    description: "VNSH Laser Strike - Migrate 5 features to custom sections",
    sections: [
      {
        type: 'image_with_text',
        title: 'The Best (and Most FUN) Way to Train Without Shooting a Single Round',
        body_html: '<p>By far the coolest thing about the new Laser Strike Enhanced Training System is the fact it comes with a "digital steel" target – which works seamlessly with your laser cartridge insert. Just rack the insert, fire at the digital steel, and grin ear-to-ear every time you hear it PING! 🤠</p>',
        image: '/images/products/LSS_Virtual_Steel.jpg',
        align: 'left',
      },
      {
        type: 'image_with_text',
        title: 'Maximize Your Defensive Capability for When It Matters Most',
        body_html: '<p>Being able to defend yourself in a life-or-death situation comes down to 1 thing: your ability to draw in seconds and put rounds on target. Reaching that level of competency with live fire training alone takes hundreds of hours at the range and potentially thousands of dollars in ammo. But with the Laser Strike System, you can max out your skills right at home!</p>',
        image: '/images/products/Laser_Strike_System.png',
        align: 'right',
      },
      {
        type: 'image_with_text',
        title: 'Super Easy, Quiet, and Safe',
        body_html: '<p>You\'ll be up and running with your new Laser Strike System in under 10 minutes. And you can easily take it with you just about anywhere. Plus, you can safely use it practically everywhere without disturbing anyone!</p>',
        image: '/images/products/LSS_Super_Easy.png',
        align: 'left',
      },
      {
        type: 'image_with_text',
        title: 'More Time Training - Less Time Cleaning',
        body_html: '<p>On top of eliminating the hassle and cost of training at the range, the Laser Strike System also reduces firearm wear and cleaning time – since it lets you train as much as you want without putting live rounds through your gun.</p>',
        image: '/images/products/Firearm_Cleaning.png',
        align: 'right',
      },
      {
        type: 'image_with_text',
        title: 'Refine Your Training Even More With Smartphone App Shot Tracking',
        body_html: '<p>In addition to your Digital Steel target, you can also train using the included traditional targets and smartphone app – giving you even more detailed feedback on performance. This is especially useful for addressing issues like wrist breaking and incorrect trigger finger placement.</p>',
        image: '/images/products/Tripod.png',
        align: 'left',
      },
    ],
  },

  "the-vnsh-holster-weapon-mounted-light-compatible": {
    productHandle: "the-vnsh-holster-weapon-mounted-light-compatible",
    description: "WML Holster - Migrate 3 features to custom sections",
    sections: [
      {
        type: 'image_with_text',
        title: 'Compatible with Leading Lights',
        body_html: '<p>Pairs with Streamlight, Olight, SureFire, Inforce, and more. Adjusts instantly for different frames and light lengths.</p>',
        align: 'left',
      },
      {
        type: 'image_with_text',
        title: 'Ambidextrous by Design',
        body_html: '<p>Switch between left-hand and right-hand draw in seconds by repositioning the holster pocket.</p>',
        align: 'right',
      },
      {
        type: 'image_with_text',
        title: 'Balanced Carry',
        body_html: '<p>Integrated mag pockets offset the extra light weight so the holster sits balanced all day.</p>',
        align: 'left',
      },
    ],
  },

  "vnsh-holster-lite": {
    productHandle: "vnsh-holster-lite",
    description: "VNSH Holster Lite - Migrate 3 features to custom sections",
    sections: [
      {
        type: 'image_with_text',
        title: 'Ultra-Minimal – Maximum Concealment & Comfort',
        body_html: '<p>While the original VNSH Holster does a fantastic job of comfortably concealing your gun plus 46+ rounds of ammo, not everyone cares about carrying spare mags. That\'s why the VNSH Holster Lite was born. It takes the superb comfort and concealability of our original holster and makes it even better, for anyone who wants the lowest profile way to carry their loaded weapon and nothing else.</p>',
        image: '/images/products/vnsh-holster-minimal.png',
        align: 'left',
      },
      {
        type: 'image_with_text',
        title: 'Universal Compatibility – 1 Holster for ALL Your Guns!',
        body_html: '<p>If you own multiple guns, you can finally stop throwing away money on separate holsters to carry them all! Just like the original VNSH Holster, the VNSH Holster Lite works with 99% of all modern semi autos, meaning you can effortlessly switch out firearms day-to-day and save serious $$$ in the process.</p>',
        image: '/images/products/vnsh-holster-universal-compatibility.png',
        align: 'right',
      },
      {
        type: 'image_with_text',
        title: 'Fully Ambidextrous + Unlimited Carry Options',
        body_html: '<p>Your ideal carry position is highly dependent on both preference and outfit. That\'s why the VNSH Holster Lite is both fully ambidextrous while also supporting any carry position you like. Hitting the grocery store in gym shorts and a t-shirt? Rock it appendix style. Headed to a business lunch in your suit? Maybe small of back is best… This holster can do it all!</p>',
        image: '/images/products/vnsh-holster-ambidextrous.png',
        align: 'left',
      },
    ],
  },
};

/**
 * MANUAL MIGRATION INSTRUCTIONS:
 *
 * This file contains the data structure for all hardcoded product sections
 * that need to be migrated to Admin-managed custom PDP sections.
 *
 * Products to migrate:
 * 1. vnsh-holster (3 features)
 * 2. vnsh-laser-strike-enhanced-training-system (5 features)
 * 3. the-vnsh-holster-weapon-mounted-light-compatible (3 features)
 * 4. vnsh-holster-lite (3 features)
 *
 * MIGRATION PROCESS:
 *
 * For each product in the productMigrations object:
 *
 * 1. Open Admin UI at http://localhost:8082/admin
 * 2. Find and click "Edit" on the product
 * 3. Scroll down to find "PDP Sections" section
 * 4. For EACH section in the sections array:
 *    a. Click "Add Section"
 *    b. Select "Image with Text" from the "Section Type" dropdown
 *    c. Fill in the fields:
 *       - Title: Use the "title" field from the section data
 *       - Description: Use the "body_html" field (copy-paste the HTML)
 *       - Image URL: Use the "image" field (if provided)
 *       - Alignment: Use the "align" field ("left" or "right")
 *    d. Don't modify other sections yet (FAQ, testimonials, etc. can be done later)
 * 5. Click "Save" to persist the metadata
 * 6. Verify the product page displays correctly
 *
 * After all products are migrated:
 *
 * 1. Remove hardcoded entries from STATIC_CONTENT in productContent.ts:
 *    - Delete vnsh-holster entry
 *    - Delete vnsh-laser-strike-enhanced-training-system entry
 *    - Delete the-vnsh-holster-weapon-mounted-light-compatible entry
 *    - Delete vnsh-holster-lite entry
 * 2. Update STATIC_CONTENT to only have DEFAULT_CONTENT-like minimal entries
 * 3. Run tests to ensure all product pages display correctly
 * 4. Delete this productMigrations.ts file
 *
 * NOTES:
 * - The console logging in ProductDetail.tsx can be removed after migration is complete
 * - FAQ sections should be added separately in Admin after features are migrated
 * - Product specs (specList, bulletFeatures) are currently displayed but not editable from Admin
 */
