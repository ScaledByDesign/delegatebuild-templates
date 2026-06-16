import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

// CSS styles for the whitelist page
const whitelistStyles = `
@import 'https://fonts.googleapis.com/css?family=Roboto';
.whitelist-content h1 {
  font-family: 'Roboto', sans-serif;
}
.whitelist-content h2 {
  font-size: 1.7em;
  margin: 0;
  padding: 0;
  font-family: 'Roboto', sans-serif;
}
.whitelist-content h3 {
  font-family: 'Roboto', sans-serif;
}
.whitelist-content h4 {
  font-size: 18px;
  font-weight: bold;
  font-family: 'Roboto', sans-serif;
}
.whitelist-content p {
  font-family: 'Roboto', sans-serif;
  font-size: 18px;
}
.whitelist-content li {
  font-size: 18px;
  font-family: 'Roboto', sans-serif;
  line-height: 30px;
}
.whitelist-content a {
  text-decoration: none;
  color: #FFFFFF;
}
.whitelist-content .mobileButton {
  margin: 2%;
  margin-bottom: 3%;
  padding: 2%;
  border: solid #adadba 1px;
  border-radius: 0px;
  text-align: center;
  font-family: verdana;
  font-weight: bold;
}
.whitelist-content ul {
  list-style: none;
}
.whitelist-content ul li {
  padding: 10px 10px;
}
.whitelist-content ul li a {
  text-align: center;
  font-size: 21px;
  text-decoration: none;
}
.whitelist-content .columnHeading {
  width: 25%;
  float: left;
}
.whitelist-content .headingBorder {
  padding: 20px 0;
  text-align: center;
  border-top: 2px solid gray;
  border-bottom: 2px solid gray;
}
.whitelist-content .endRow {
  float: right;
}
.whitelist-content .clearRight {
  clear: left;
}
.whitelist-content .submenuPopularAppBtn,
.whitelist-content .submenuEmailClientBtn,
.whitelist-content .submenuSecuritySoftBtn,
.whitelist-content .submenuSpamFiltersBtn {
  text-align: center;
  width: 75%;
  padding: 10px;
  cursor: pointer;
}
.whitelist-content .submenuPopularAppBtn {
  background-color: #007abd;
}
.whitelist-content .submenuEmailClientBtn {
  background-color: #7ec324;
}
.whitelist-content .submenuSecuritySoftBtn {
  background-color: #fdab00;
}
.whitelist-content .submenuSpamFiltersBtn {
  background-color: #eb605a;
}
@media only screen and (min-width:600px) and (max-width: 879px) {
  .whitelist-content .columnHeading {
    width: 50%;
  }
  .whitelist-content #sSoftware {
    clear: left;
  }
}
@media only screen and (min-width: 880px) and (max-width:1140px) {
  .whitelist-content .columnHeading {
    width: 33.33333%;
  }
  .whitelist-content #sFilters {
    clear: both;
  }
}
@media only screen and (min-width:0) and (max-width:600px) {
  .whitelist-content .columnHeading {
    width: 100%;
  }
  .whitelist-content .clearFix {
    clear: both;
  }
}
.whitelist-content .instruction-icon {
  float: left;
  margin: 10px;
}
`;

const WhitelistInstruction = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <title>Whitelist Instruction – VNSH</title>
      <meta name="description" content="Whitelist VNSH to be sure you get the email you requested. Instructions for Gmail, Yahoo, Outlook, iPhone Mail, and more." />
      <meta name="robots" content="index, follow" />
      <link rel="canonical" href="https://vnsh.com/blogs/whitelist/whitelist-instruction" />
      
      <style>{whitelistStyles}</style>
      
      <Navbar />
      
      <main className="flex-grow bg-white">
        <article className="whitelist-content max-w-5xl mx-auto px-4 py-12">
          {/* Content will be added in the next edit */}
          <div className="article-content" dangerouslySetInnerHTML={{ __html: whitelistHtmlContent }} />
        </article>
      </main>

      <Footer />
    </div>
  );
};

// The main HTML content
const whitelistHtmlContent = `
<center>
<h1>VNSH Email Whitelist Instructions</h1>
</center>
<p>Since your Email Provider probably uses some type of overzealous filtering; We ask that you add us to your trusted list of senders, contacts or address book. All also known as "Whitelisting."</p>
<p>If you do not see an email from <strong>VNSH</strong> in your Inbox, my email may have mistakenly been sent to your spam folder.</p>
<p>Please <strong>open your spam folder</strong> and if you find an email from <strong>VNSH</strong> open it and mark it as <strong>"Not spam"</strong>...</p>
<p><u>NEXT</u>: Click your provider below to Whitelist <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong></p>

<div class="container-app">
<div class="columnHeading">
<div class="pageHeadings" id="eService">
<h2 class="headingBorder">Popular Apps</h2>
<ul class="submenu">
<li><div class="submenuPopularAppBtn"><a href="#gmail">Gmail</a></div></li>
<li><div class="submenuPopularAppBtn"><a href="#gmailapp">Gmail App</a></div></li>
<li><div class="submenuPopularAppBtn"><a href="#gmailtabs">Gmail Tabs</a></div></li>
<li><div class="submenuPopularAppBtn"><a href="#iphoneapp">iPhone Mail</a></div></li>
<li><div class="submenuPopularAppBtn"><a href="#yahoo">Yahoo</a></div></li>
<li><div class="submenuPopularAppBtn"><a href="#outlookapp">Outlook App</a></div></li>
<li><div class="submenuPopularAppBtn"><a href="#outlook">Outlook</a></div></li>
</ul>
</div>
</div>
<div class="columnHeading" id="eClients">
<div class="pageHeadings">
<h2 class="headingBorder">Email Clients</h2>
<ul class="submenu">
<li><div class="submenuEmailClientBtn"><a href="#outlookdotcom">Outlook.com</a></div></li>
<li><div class="submenuEmailClientBtn"><a href="#aol">AOL Web Mail</a></div></li>
<li><div class="submenuEmailClientBtn"><a href="#comcast">Comcast</a></div></li>
<li><div class="submenuEmailClientBtn"><a href="#earthlink">EarthLink</a></div></li>
<li><div class="submenuEmailClientBtn"><a href="#att">AT&amp;T</a></div></li>
<li><div class="submenuEmailClientBtn"><a href="#thunderbird">Thunderbird</a></div></li>
</ul>
</div>
</div>
<div class="columnHeading" id="sSoftware">
<div class="pageHeadings">
<h2 class="headingBorder">Security Apps</h2>
<ul class="submenu">
<li><div class="submenuSecuritySoftBtn"><a href="#norton">Norton</a></div></li>
<li><div class="submenuSecuritySoftBtn"><a href="#mcafee">McAfee</a></div></li>
<li><div class="submenuSecuritySoftBtn"><a href="#trend-micro">Trend Micro</a></div></li>
</ul>
</div>
</div>
<div class="columnHeading" id="sFilters">
<div class="pageHeadings">
<h2 class="headingBorder">Spam Filters</h2>
<ul class="submenu">
<li><div class="submenuSpamFiltersBtn"><a href="#cloudmark">Cloudmark</a></div></li>
<li><div class="submenuSpamFiltersBtn"><a href="#sanebox">SaneBox</a></div></li>
<li><div class="submenuSpamFiltersBtn"><a href="#barracuda">Barracuda Net</a></div></li>
<li><div class="submenuSpamFiltersBtn"><a href="#spamassassin">SpamAssassin</a></div></li>
<li><div class="submenuSpamFiltersBtn"><a href="#top-spam-filters">Top Spam Filters</a></div></li>
</ul>
</div>
</div>
</div>
<br />
<div style="clear: both;">
<p><strong>Is your email client or spam filter not listed?</strong></p>
<p>If <strong>VNSH</strong> is being filtered, try adding <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong> to your Address Book or Contact list.</p>
<p>If messages continue to be sent to your junk folder contact your ISP or spam filter application support and ask how to whitelist <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong></p>
</div>

<br /><br />

<!-- Gmail Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/gmail-logo.webp?v=1761153217" class="instruction-icon" alt="Gmail Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="gmail">Gmail</h2>
</span>
</div>
<h4>At times, Gmail mistakenly sends emails you want, to the Spam folder...</h4>
<p>If you do not readily find an email from <strong>VNSH</strong></p>
<p>Please check your <strong>Gmail Spam Folder:</strong></p>
<p>To assure you continue to get emails you asked to receive, <strong>Create a Filter</strong></p>
<ol>
<li>If you find an email from <strong>VNSH</strong> in Gmail spam?</li>
<li>Open the email please.</li>
<li>Click 'Dots' button on the top right, to reveal your choices.</li>
</ol>
<p>Click <strong>Filter messages like this</strong></p>
<br />
<table cellspacing="0" cellpadding="0" style="border: 1px solid #CCCCCC;">
<tbody>
<tr><td><p>&nbsp; Reply</p></td></tr>
<tr><td><p>&nbsp; Forward</p></td></tr>
<tr><td style="background-color: #eeeeee;"><p>&nbsp; Filter messages like this &nbsp;</p></td></tr>
</tbody>
</table>
<br />
<p>Click the button <span style="color: #5f6368; background-color: #f2f2f2; border: 0px solid; border-radius: 5px; padding: 2px;">&nbsp;Create filter&nbsp;</span>&nbsp; to open your settings.</p>
<p>From the next menu, please check these options</p>
<br />
<table cellspacing="0" cellpadding="0" style="border: 1px solid #CCCCCC;">
<tbody>
<tr><td><p><input checked type="checkbox" />&nbsp; Never send it to Spam &nbsp;</p></td></tr>
<tr><td><p><input checked type="checkbox" />&nbsp; Always mark it as important &nbsp;</p></td></tr>
<tr><td><p><input checked type="checkbox" />&nbsp; Also apply filter to matching conversations &nbsp;</p></td></tr>
<tr><td><p><input checked type="checkbox" />&nbsp; Categorize as: Choose Category...&nbsp;</p></td></tr>
</tbody>
</table>
<p>Under the "Categorize as: Choose Category..."</p>
<ol>
<li>Click the dropdown icon next to "Choose Category..."</li>
<li>Please select <strong>Primary</strong> in the next options menu.</li>
</ol>
<br />
<table cellspacing="0" cellpadding="0" style="border: 1px solid #CCCCCC;">
<tbody>
<tr><td><p>&nbsp; Choose Category... &nbsp;</p></td></tr>
<tr><td style="background-color: #eeeeee;"><p>&nbsp; Primary</p></td></tr>
<tr><td><p>&nbsp; Social</p></td></tr>
<tr><td><p>&nbsp; Updates</p></td></tr>
<tr><td><p>&nbsp; Forums</p></td></tr>
<tr><td><p>&nbsp; Promotions</p></td></tr>
</tbody>
</table>
<p>Click the blue <span style="color: #ffffff; background-color: #1a73e8; border: 0px solid; border-radius: 5px; padding: 2px;">&nbsp;Create filter&nbsp;</span>&nbsp; button, to save your settings</p>
<br />
<p>Now you will always see <strong>VNSH</strong> in your Primary Inbox tab!</p>
<p>Next, if the email remains open? Please mark the email as "Not spam"</p>
<ol>
<li>- If you see an email from <strong>VNSH</strong>: Open the email please.</li>
<li>- Click the button on the alert, labeled <span style="color: #ffffff; border: 1px solid #FFFFFF; border-radius: 5px; background-color: #616161; padding: 3px;">Report Not spam </span></li>
</ol>
<br />
<div style="background-color: #616161; border: #f0c36d 0px solid; border-radius: 5px; padding: 1px;">
<p>&nbsp;
<img alt="alert icon" src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/alert-sm.webp?v=1760995538" height="20" style="height: 20px;" />&nbsp;
<span style="color: #ffffff;">
<strong>Why is this message in spam?</strong> It is similar to messages that were identified as spam in the past. <br /><br />&nbsp; &nbsp;
<span style="border: 1px solid #FFFFFF; border-radius: 5px; padding: 3px;">Report not spam</span>
</span>
</p>
</div>

<br /><br />

<!-- Gmail Tabs Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/gmail-logo.webp?v=1761153217" class="instruction-icon" alt="Gmail Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="gmailtabs">Gmail Tabs</h2>
</span>
</div>
<p>- If you are using Gmail Tabs such as 'Promotions' please open your Promotions tab in Gmail.</p>
<ol>
<li>- If you find an email from <strong>VNSH</strong> in your Gmail Promotions tab:</li>
<li>- Grab and drag my email to the Primary Inbox Tab.</li>
<li>- After doing so, you will receive an alert like the one below at the top of your Gmail toolbar.</li>
</ol>
<br />
<div style="background-color: #202124; border: #202124 1px solid; border-radius: 5px;">
<p style="color: #ffffff; padding-left: 10px;">Conversation moved to Primary. Do this for future messages from info@vnsh.com and customercare@vnsh.com?</p>
<p style="color: #8ab4f8; padding-left: 40px;">Yes &nbsp; Undo</p>
</div>
<br />
<ol>
<li>- Click <u>Yes</u> in the black alert box at Gmail.</li>
<li>- This way you will always see <strong>VNSH</strong> in your Primary Inbox tab...</li>
</ol>
<h4>Also you can create a filter...</h4>
<ol>
<li>- If you find an email from <strong>VNSH</strong> in your Gmail Promotions tab:</li>
<li>- Open the email please.</li>
<li>- Click the dots menu on the top left of the email.</li>
</ol>
<p>Click <strong>Filter messages like this</strong>.</p>
<br />
<table cellspacing="0" cellpadding="0" style="border: 1px solid #CCCCCC;">
<tbody>
<tr><td><p>&nbsp; Reply</p></td></tr>
<tr><td><p>&nbsp; Forward</p></td></tr>
<tr><td style="background-color: #eeeeee;"><p>&nbsp; Filter messages like this &nbsp;</p></td></tr>
</tbody>
</table>
<br />
<p>Click the button <span style="color: #5f6368; background-color: #f2f2f2; border: 0px solid; border-radius: 5px; padding: 2px;">&nbsp;Create filter&nbsp;</span>&nbsp; to open your settings.</p>
<p>Please select <strong>Primary</strong> in the next options menu.</p>
<br />
<table cellspacing="0" cellpadding="0" style="border: 1px solid #CCCCCC;">
<tbody>
<tr><td><p>&nbsp; Choose Category... &nbsp;</p></td></tr>
<tr><td style="background-color: #eeeeee;"><p>&nbsp; Primary</p></td></tr>
<tr><td><p>&nbsp; Social</p></td></tr>
<tr><td><p>&nbsp; Updates</p></td></tr>
<tr><td><p>&nbsp; Forums</p></td></tr>
<tr><td><p>&nbsp; Promotions</p></td></tr>
</tbody>
</table>
<br />
<p>Click the blue <span style="color: #ffffff; background-color: #1a73e8; border: 0px solid; border-radius: 5px; padding: 2px;">&nbsp;Create filter&nbsp;</span>&nbsp; button, to save your settings</p>
<br />
<p>Now you will always see <strong>VNSH</strong> in your Primary Inbox tab...</p>

<br /><br />

<!-- Gmail Mobile App Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/gmail-logo.webp?v=1761153217" class="instruction-icon" alt="Gmail Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="gmailapp">Gmail Mobile App</h2>
</span>
</div>
<h4>If you are using the Gmail Mobile App on your mobile device, please open the app now</h4>
<p>Should you not readily see an email from <strong>VNSH</strong>, please check the Spam Folder:</p>
<p>Should an email from <strong>VNSH appear mistakenly</strong> sent to Gmail spam?</p>
<p>&nbsp;1. Find and open the email from VNSH (or any sender you trust).</p>
<p>&nbsp;2. Tap the three-dot menu (⋮) in the top right corner of the email.</p>
<p>&nbsp;3. Select "Report not spam" or "Not spam".</p>
<p>&nbsp;4. This will immediately move the email back to your Inbox.</p>
<p>&nbsp;5. Gmail will also learn from this action to avoid marking future emails from that sender as spam.</p>
<br />
<p><strong>Are you are using Gmail Tabs such as "Promotions"</strong> please open your Promotions tab in Gmail.</p>
<ol>
<li>When you find the email from <strong>VNSH</strong></li>
<li>Tap the Three-Dot (...) menu icon - top right.</li>
<li>Then select <strong>Move</strong>.</li>
</ol>
<br />
<table cellspacing="0" cellpadding="0" style="border: 1px solid #CCCCCC;">
<tbody>
<tr><td><p>&nbsp; Snooze &nbsp;</p></td></tr>
<tr><td><p style="background-color: #eeeeee;">&nbsp; Move &nbsp;</p></td></tr>
<tr><td><p>&nbsp; Label &nbsp;</p></td></tr>
<tr><td><p>&nbsp; Mark as not important &nbsp;</p></td></tr>
</tbody>
</table>
<br />
<ol>
<li>Then select <strong>Primary</strong> from the list.<br />
<img alt="Screenshot of the Gmail app move to menu" style="border: 1px solid #CCCCCC; height: 200px; width: auto;" src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/gmail-mobile-move-whitelist.webp?v=1761059821" height="200" width="auto" />
</li>
</ol>
<p>This should help Gmail to know, you always want to see <strong>VNSH</strong> in your Primary Inbox tab...</p>

<br /><br />

<!-- Yahoo Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/yahoomail-logo.webp?v=1760995539" class="instruction-icon" alt="Yahoo Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="yahoo">Yahoo! Mail</h2>
</span>
</div>
<h4>If you do not see an email from <strong>VNSH</strong> in your Inbox...</h4>
<p>Check your Spam Folder. If an email from <strong>VNSH</strong> is there?</p>
<ol>
<li>- Please open the email.</li>
<li>- Next click the <strong>Not Spam</strong> button on the top toolbar.</li>
</ol>
<p>To ensure delivery: Create a filter to automatically send email from <strong>VNSH</strong> to your Inbox.</p>
<ol>
<li>- Move your mouse over or tap the <strong>Gear</strong> icon in the top right navigation bar.</li>
<li>- Select <strong>Settings</strong> from the list that drops down.</li>
<li>- Choose <strong>Filters</strong> located on the left side of the page.</li>
<li>- Click the <strong>Add</strong> button on the Filters page.</li>
<li>- Create a name such as <strong>Whitelist</strong> in the <strong>Filter name</strong> field.</li>
<li>- In the <strong>From</strong> field leave the default <strong>contains</strong> selected.</li>
<li>- Enter our email address <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong> in the text box next to <strong>Contains...</strong></li>
<li>- Choose the destination folder to which you would like the message delivered. For example: Inbox.</li>
<li>- Click or tap <strong>Save...</strong></li>
<li>- You will see in the next screen -Deliver to <strong>Inbox</strong> if From contains <strong>VNSH</strong>-</li>
<li>- Click or tap <strong>Save</strong> on this screen.</li>
<li>- You will be returned to your Yahoo! Inbox.</li>
</ol>

<br /><br />

<!-- iPhone Mail App Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/iosmail-logo.webp?v=1760995538" class="instruction-icon" alt="iPhone Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="iphoneapp">iPhone Mail App</h2>
</span>
</div>
<h4>iPhone Mail identifies most junk mail (spam) sent to your @icloud.com address or aliases, but it can mistakenly move email incorrectly to your Junk mail folder.</h4>
<p>Periodically check the Junk folder for email messages that were marked as junk mistakenly.</p>
<p>To indicate that an email message from <strong>VNSH</strong> isn't junk:</p>
<ol>
<li>- Open your Mail app and go to the Mailboxes screen</li>
<li>- Scroll down to the folders area<br />
<img alt="Screenshot of iPhone mailboxes screen" style="border: 1px solid #CCCCCC; height: 250px; width: auto;" src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/iphone-mail-box-whitelist.webp?v=1761144726" height="250" width="auto" /></li>
<li>- Select the <strong>Junk</strong> folder.</li>
<li>- Find the email from <strong>VNSH</strong> and slide it left to see options.<br />
<img alt="Screenshot of iPhone swipe left screen" style="border: 1px solid #CCCCCC; height: 250px; width: auto;" src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/iphone-mail-more-whitelist.webp?v=1761144726" height="250" width="auto" /></li>
<li>- Tap the <strong>More</strong> button.</li>
<li>- Tap the <strong>Move to Inbox</strong> button.<br />
<img alt="Screenshot of iPhone mail not junk screen" style="border: 1px solid #CCCCCC; height: 250px; width: auto;" src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/iphone-mail-move-inbox-whitelist.webp?v=1761144726" height="250" width="auto" /></li>
</ol>
<p>The message is moved to your Inbox. Subsequent email messages from <strong>VNSH</strong> will no longer be marked as junk.</p>
<p>By default, messages in the Junk folder are deleted after 30 days so be sure to check it often to whitelist relevant email.</p>

<br /><br />

<!-- Outlook Mobile App Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/outlook-logo.webp?v=1760995538" class="instruction-icon" alt="Outlook Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="outlookapp">Outlook Mobile App</h2>
</span>
</div>
<h4>Outlook's mobile app now offers a "Focused Inbox" for your important email</h4>
<p>- To add <strong>VNSH</strong> to your list of <strong>Focused Inbox</strong> on the Outlook App...</p>
<p>Please open the mobile Outlook app on your Android, Microsoft or iPhone:</p>
<p>Then open the email from <strong>VNSH</strong>:</p>
<ol>
<li>- Tap the three-dot menu (⋯)<br />
<img alt="Screenshot of Outlook App dropdown menu" width="250" style="border: 1px solid #CCCCCC;" src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/outlook-three-dot-whitelist.webp?v=1761151031" /></li>
<li>- On the menu displayed tap <strong>Move to Focused</strong><br />
<img alt="Screenshot of Outlook App dropdown menu" width="250" style="border: 1px solid #CCCCCC;" src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/outlook-move-whitelist.webp?v=1761149350" height="250" /></li>
<li>- Select the <strong>Always Move</strong> option.<br />
<img alt="Screenshot of Outlook App move to screen" width="250" style="border: 1px solid #CCCCCC;" src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/outlook-move-always-whitelist.webp?v=1761149351" /></li>
<li>Now all future messages from <strong>VNSH</strong> will appear in your <strong>Focused Inbox</strong></li>
</ol>
<p>You can also remove unwanted emails from your <strong>Focused Inbox</strong> as well by repeating this process in your Focused tab.</p>

<br /><br />

<!-- Outlook Desktop Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/outlook-logo.webp?v=1760995538" class="instruction-icon" alt="Outlook Logo" height="30" width="30" style="height: 30px; width: auto;" />
<span style="margin-left: 10px;">
<h2 id="outlook">Outlook 2003, Outlook 2016 and Outlook Office 365</h2>
</span>
</div>
<h4>To ensure you continue to receive important emails in Outlook Office:</h4>
<p>Please add <strong>VNSH</strong> to your list of "Safe senders" on Outlook:</p>
<ol>
<li>- Right click our email in your Inbox email list pane.</li>
<li>- On the menu displayed move your mouse over or tap <strong>Junk</strong></li>
<li>- Click or tap on <strong>Never block sender</strong> in the menu that rolls out.</li>
<li>- The resulting popup will say:</li>
<li>- "The sender of the selected message has been added to your Safe Senders List."</li>
<li>- Click <strong>OK</strong></li>
</ol>
<p><strong>To add sender to address book:</strong></p>
<ol>
<li>- Open the email</li>
<li>- Right click on the from address</li>
<li>- Choose <strong>Add to contacts</strong> option</li>
</ol>

<br /><br />

<!-- Outlook.com Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/outlook-logo.webp?v=1760995538" class="instruction-icon" alt="Outlook Logo" height="30" width="30" style="height: 30px; width: auto;" />
<span style="margin-left: 10px;">
<h2 id="outlookdotcom">Outlook.com</h2>
</span>
</div>
<h4>Previously "Hotmail", "Live", "Windows Live" and "MSN"...</h4>
<p>In the new Outlook.com you must click the <strong>Wait it's safe</strong> link if you find emails incorrectly identified as spam.</p>
<p>Entering the email contact in the address book or contacts no longer whitelists the sender.</p>
<p>To ensure messages from specific email addresses are not sent to your Junk Email folder, you can do one of two things:</p>
<ol>
<li>- Check the <strong>Junk</strong> folder. If you see the <strong>VNSH</strong> email in your Inbox</li>
<li>- Open the email from <strong>VNSH</strong>...</li>
<li>- Click the "Wait it's safe" link</li>
</ol>
<p><strong>Mark Sender as "Wait it's safe!"</strong></p>
<div>
<hr />
<p>VNSH (info@vnsh.com and customercare@vnsh.com) <br />To: you@outlook.com</p>
<div style="border: 1px #CCCCCC solid; padding: 5px;">
<p>Microsoft SmartScreen marked this message as junk and we'll delete it after ten days. <br /> <span style="color: #187fcb;">Wait, it's safe!</span> | <span style="color: #187fcb;">I'm not sure. Let me check</span></p>
</div>
<br />
<p><strong>Manually Add to Safe List</strong></p>
<ol>
<li>- Click gear the icon on the top right.</li>
<li>- Select <strong>Options</strong> in the drop down list.</li>
<li>- On the Options page under <strong>Preventing junk email</strong> click <strong>Safe and blocked senders</strong></li>
<li>- Click the link <strong>Safe senders</strong> on the next page.</li>
<li>- Enter the email addresses <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong> in the text box.</li>
<li>- Click <strong>Add to list</strong></li>
<li>- <strong>VNSH</strong> will now be added to your list of <strong>Safe senders</strong></li>
<li>- Emails added to your <strong>Safe senders</strong> will not be delivered by mistake to your <strong>Junk</strong> folder.</li>
</ol>
</div>

<br /><br />

<!-- AOL Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/webmail-logo.webp?v=1760995539" class="instruction-icon" alt="AOL Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="aol">AOL WEBMAIL</h2>
</span>
</div>
<h4>To ensure important emails get delivered to your AOL Inbox- Please complete these two steps...</h4>
<p>If you find <strong>VNSH</strong> in your spam folder:</p>
<ol>
<li>Right click the email.</li>
<li>Click "Not spam" in the resulting list.</li>
</ol>
<p>Add <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong> to your Address Book:</p>
<ol>
<li>- Open the email from <strong>VNSH</strong></li>
<li>- Click the <strong>show details</strong> link next to <strong>VNSH</strong> in the From field.</li>
<li>- Move your mouse over or tap <strong>info@vnsh.com</strong>/<strong>customercare@vnsh.com</strong> to show the menu.</li>
<li>- Click or tap <strong>Add contact</strong> in the menu displayed.</li>
<li>- Add <strong>VNSH</strong> to the name fields</li>
<li>- Click <strong>Add contact</strong></li>
</ol>
<p><strong>Next: Please Enable Images</strong></p>
<div style="background-color: #f5f5f5; padding: 10px; border: 1px solid #ddd;">
<img alt="alert icon" src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/alert-sm.webp?v=1760995538" height="20" style="height: 20px;" />
<strong>Images blocked</strong><br />
Show images | Don't block this sender
</div>
<ol>
<li>- By default AOL now blocks all images.</li>
<li>- Open the email from <strong>VNSH</strong> please.</li>
<li>- Click <strong>Don't block this sender</strong> please.</li>
<li>- Now you will see our complete emails with no effort on your part...</li>
</ol>
<p>Email from that Domain will now be delivered straight to your Inbox.</p>

<br /><br />

<!-- Comcast Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/comcast-logo.webp?v=1760995538" class="instruction-icon" alt="Comcast Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="comcast">COMCAST</h2>
</span>
</div>
<h4>Please log into your Xfinity account and select your Comcast webmail:</h4>
<p>Should you find an email from <strong>VNSH</strong> in your spam folder:</p>
<ol>
<li>Open the email.</li>
<li>Click the not spam icon on the top toolbar.</li>
</ol>
<br />
<img alt="Not spam icon" src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/comcast-not-spam-whitelist.webp?v=1761152084" style="border: 1px solid #CCCCCC;" />
<p>Next please, add <strong>VNSH</strong> to your address book:</p>
<ol>
<li>- Please open the email from <strong>VNSH</strong>.</li>
<li>- Click on the button at the top left of the email that says:</li>
</ol>
<div style="background-color: #f5f5f5; padding: 10px; border: 1px solid #ddd;">
info@vnsh.com/customercare@vnsh.com<br />
+ Add to Address Book
</div>
<ol>
<li>- That will open your edit contact screen.</li>
<li>- Then click <strong>Save</strong> and you're all done.</li>
</ol>

<br /><br />

<!-- EarthLink Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/earthlink-logo.webp?v=1760995538" class="instruction-icon" alt="EarthLink Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="earthlink">EARTHLINK</h2>
</span>
</div>
<h4>If you are not receiving email at EarthLink, there are two actions you can take.</h4>
<ol>
<li>- Check <strong>Suspect Email</strong> folder</li>
<li>- Add <strong>VNSH</strong> to your address book.</li>
</ol>
<p>With EarthLink, if you have SpamBlocker turned on, suspect messages are automatically send to your Suspect Email folder if the Domain is not in your address book.</p>
<p><strong>Suspect Email Folder:</strong></p>
<ol>
<li>- While in the <strong>Suspect Email</strong> folder, if you see <strong>VNSH</strong>...</li>
<li>- Select the <strong>Move to Inbox and Add Contact</strong> option from the drop down menu.</li>
<li>- This will add <strong>info@vnsh.com/customercare@vnsh.com</strong> to your Address Book for future email delivery assurance.</li>
</ol>
<p><strong>Address Book Inclusion:</strong></p>
<ol>
<li>- Open the email.</li>
<li>- Click Add to Address Book in the email header.</li>
<li>- Use the Address Book Editor to verify the sender's contact details and click save.</li>
<li>- Fill in <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong> as the email address of the sender.</li>
<li>- Any mail sent with the same Domain (right of the @ sign) will now be delivered to your Inbox.</li>
</ol>

<br /><br />

<!-- AT&T Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/att-logo.webp?v=1760995487" class="instruction-icon" alt="AT&T Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="att">AT&amp;T</h2>
</span>
</div>
<h4>AT&amp;T no longer maintains their own inbox.</h4>
<p>Instead you can find your AT&amp;T emails at Att.Yahoo.com</p>
<p>Please follow the Yahoo instructions for whitelisting an ATT.net email address.</p>
<p>Click or Tap here, to scroll to the <a href="#yahoo" style="color: #007abd;">Yahoo instructions...</a></p>

<br /><br />

<!-- Thunderbird Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/mozilla_thunderbird-logo.webp?v=1760995539" class="instruction-icon" alt="Thunderbird Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="thunderbird">MOZILLA THUNDERBIRD</h2>
</span>
</div>
<h4>Please open your Thunderbird email client:</h4>
<p>If an email from <strong>VNSH</strong> appears in your Junk Folder:</p>
<p>Please mark that message as <strong>Not Junk</strong>.</p>
<p>Next, please add <strong>VNSH</strong> to your Address Book:</p>
<ol>
<li>- Click the <strong>Address Book</strong> button.</li>
<li>- Make sure the <strong>Personal Address Book</strong> is highlighted.</li>
<li>- Click the <strong>New Contact</strong> button.</li>
<li>- Under the <strong>Contact tab</strong>, copy and paste the "From" address, <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong> into the email text box.</li>
<li>- Click <strong>OK</strong>.</li>
</ol>

<br /><br />

<!-- Security Software Section Header -->
<h2>SECURITY SOFTWARE</h2>
<br />

<!-- Norton Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/norton-logo.webp?v=1760995538" class="instruction-icon" alt="Norton Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="norton">NORTON ANTISPAM</h2>
</span>
</div>
<p>This problem may occur if <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong> is accidentally added to the Blocked List.</p>
<p><strong>To remove the info@vnsh.com and customercare@vnsh.com from the Blocked List:</strong></p>
<ol>
<li>- Start your Norton product.</li>
<li>- Click Settings.</li>
<li>- Depending on your Norton product, do one of the following:</li>
</ol>
<p><strong>For Norton 360:</strong></p>
<ol>
<li>In the Settings window, under Detailed Settings, click AntiSpam.</li>
<li>On the Filter tab, next to Blocked List, click Configure.</li>
</ol>
<p><strong>For Norton Internet Security:</strong></p>
<ol>
<li>In the Settings window, on the Network tab, click Message Protection.</li>
<li>Under AntiSpam, next to Blocked List, click Configure.</li>
</ol>
<ol>
<li>- In the Blocked List window, select the item that you want to remove, and then click Remove.</li>
<li>- Click Apply, and then click OK.</li>
<li>- If you do not find <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong> in the Blocked list, go to next step.</li>
</ol>
<p><strong>To add info@vnsh.com and customercare@vnsh.com to the Allowed List:</strong></p>
<ol>
<li>- Start your Norton product.</li>
<li>- Click Settings.</li>
<li>- Depending on your Norton product, do one of the following:</li>
</ol>
<p><strong>For Norton 360:</strong></p>
<ol>
<li>In the Settings window, under Detailed Settings, click AntiSpam.</li>
<li>On the Filter tab, next to Allowed List, click Configure.</li>
</ol>
<p><strong>For Norton Internet Security:</strong></p>
<ol>
<li>In the Settings window, on the Network tab, click Message Protection.</li>
<li>Under AntiSpam, next to Allowed List, click Configure.</li>
</ol>
<ol>
<li>- In the Allowed List window, click Add.</li>
<li>- In the Add Email Address window, from the Address Type drop-down, select the address type.</li>
<li>- Add <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong>, and then click OK.</li>
<li>- In the Allowed List window, click Apply, and then click OK.</li>
</ol>

<br /><br />

<!-- McAfee Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/mcafee-logo.webp?v=1760995538" class="instruction-icon" alt="McAfee Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="mcafee">MCAFEE PRODUCTS</h2>
</span>
</div>
<p>While McAfee has removed spam protection in the latest Anti-Virus software- You may still have a version that offers spam filtering.</p>
<p>In order to add <strong>VNSH</strong> to the friends whitelist, please open McAfee and click on <strong>Web & Email Protection</strong>.</p>
<p>Then click on <strong>Anti-Spam</strong></p>
<p>There you can see various settings. You can change the spam protection level, change filter settings, etc.</p>
<p>Click on <strong>Friends list</strong></p>
<ol>
<li>- Please add <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong> to your "Friends List" to always allow emails from <strong>VNSH</strong>.</li>
</ol>

<br /><br />

<!-- Trend Micro Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/trendmicro-logo.webp?v=1760995539" class="instruction-icon" alt="Trend Micro Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="trend-micro">TREND MICRO</h2>
</span>
</div>
<p>If you received an email message from VNSH that was incorrectly moved to the Spam Mail folder by the Anti-Spam Toolbar you can prevent this from occurring in the future</p>
<p>The Anti-Spam Toolbar detects spam by looking for certain keywords in the email's subject or body. Occasionally, it may detect what you consider legitimate email as spam.</p>
<p>To prevent this from occurring you can do either of the following:</p>
<ol>
<li>- Add the <strong>VNSH</strong> to the list of Approved Senders.</li>
<li>- Decrease the Spam Email Filter Strength.</li>
</ol>
<p><strong>Note:</strong> You can also select the email and click Not Spam to report it to Trend Micro. However, this feature serves only as a reference to their spam database, and it may not have an effect on how the toolbar detects spam.</p>
<p><strong>Add the sender to the list of Approved Senders:</strong></p>
<ol>
<li>- Open Microsoft Outlook.</li>
<li>- Click the Spam Mail folder then select the legitimate email detected as spam.</li>
<li>- Click <strong>Approve Sender</strong> on the toolbar.</li>
<li>- Click <strong>Yes</strong> when the confirmation message appears.</li>
</ol>
<p><strong>Decrease the Spam Email Filter Strength:</strong></p>
<ol>
<li>- Open Microsoft Outlook.</li>
<li>- Click Trend Micro Anti-Spam then click Settings.</li>
<li>- On the Spam Filter tab, move the slider bar to select a lower filter strength.</li>
<li>- Click OK to save your settings.</li>
</ol>

<br /><br />

<!-- Spam Filters Section Header -->
<h2>SPAM FILTERS</h2>
<br />

<!-- Cloudmark Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/cloudmark-seeklogo.webp?v=1760995538" class="instruction-icon" alt="Cloudmark Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="cloudmark">CLOUDMARK SPAMNET</h2>
</span>
</div>
<h4>Cloudmark filters email based on content footprints. To assure our email has not been mis-identified as spam:</h4>
<br />
<ol>
<li>- Select Cloudmark | Options... from the Cloudmark SpamNet toolbar in Outlook.</li>
<li>- Click Advanced.</li>
<li>- Go to the Whitelist tab.</li>
<li>- Click the Add button.</li>
<li>- Type: <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong></li>
<li>- Click OK.</li>
<li>- Click OK.</li>
<li>- Click Yes.</li>
<li>- Click OK.</li>
</ol>

<br /><br />

<!-- SaneBox Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/sanebox-logo.webp?v=1760995539" class="instruction-icon" alt="SaneBox Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="sanebox">SANEBOX</h2>
</span>
</div>
<p>Sanebox is not a filter, but a filtering system trained by you.</p>
<ol>
<li>- Open your Webmail or Gmail where you use SaneBox.</li>
<li>- Open your @SaneLater folder.</li>
<li>- If you find an email from <strong>VNSH</strong> or an email from <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong> in @SaneLater...</li>
<li>- Please drag my email to your Inbox folder.</li>
<li>- By doing this you will always get our great content in your Inbox from now on!</li>
</ol>

<br /><br />

<!-- SpamAssassin Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/spamassassin-logo.webp?v=1760995538" class="instruction-icon" alt="SpamAssassin Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="spamassassin">SPAM ASSASSIN</h2>
</span>
</div>
<p>Spam Assassin is usually administered by your server admin. Please contact your admin and request that he or she:</p>
<br />
<ol>
<li>- Add the following entry to your user_prefs file, which is found in the .spamassassin subdirectory on your web/mail server</li>
<li>- <strong>whitelist_from info@vnsh.com</strong></li>
<li>- <strong>whitelist_from customercare@vnsh.com</strong></li>
<li>- Save the user_prefs file or move the updated copy to your .spamassassin subdirectory.</li>
</ol>

<br />

<!-- Barracuda Section -->
<div style="display: flex; align-items: center;">
<img src="https://cdn.shopify.com/s/files/1/0670/4948/8684/files/barracuda-logo.webp?v=1760995538" class="instruction-icon" alt="Barracuda Logo" height="30" width="30" />
<span style="margin-left: 10px;">
<h2 id="barracuda">BARRACUDA NETWORKS</h2>
</span>
</div>
<h4>Occasionally, Barracuda Spam Firewall will mark a legitimate message as spam. There are two methods to whitelist email senders.</h4>
<p><strong>Whitelist Quarantined Senders:</strong></p>
<ol>
<li>- Open your email client. Barracuda should send you a summary each day listing quarantined items. Choose the most recent Barracuda email message.</li>
<li>- Locate the email from <strong>VNSH</strong> and the sender email addresses <strong>info@vnsh.com and customercare@vnsh.com</strong> that you do not want quarantined in the future. Click on the word "Whitelist," which is in green print to the right of the email title. This will open your list in a web browser.</li>
<li>- Click the box to the left of the email that you would like to whitelist. At the top of the page, click "Whitelist." Barracuda will not block or quarantine the sender whose email address appears on the whitelist.</li>
</ol>
<p><strong>Whitelist Senders and Domains:</strong></p>
<ol>
<li>- Open your web browser. Navigate to your company's Barracuda firewall homepage.</li>
<li>- Click on the <strong>Block/Accept</strong> tab.</li>
<li>- Choose "Sender Domain Block/Accept." Enter the Domain name from <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong> to whitelist. For example, you can enter aol.com to allow all AOL addresses.</li>
<li>- You may enter a comment to remind you why you allowed this Domain. Click "Add."</li>
<li>- Click your mouse on the "Email Sender Block/Accept" tab. Enter the email address of an individual sender that you want to whitelist, such as "<strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong>"</li>
<li>- Include a comment. Click "Add." In the future, Barracuda will not block emails from this sender.</li>
</ol>

<br /><br />

<!-- Most Used Spam Filters Section -->
<h2 id="top-spam-filters">MOST USED SPAM FILTERS</h2>
<br />

<h2>SPAMFIGHTER</h2>
<p>Highlight the email from <strong>VNSH</strong> with the email addresses <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong> to Whitelist.</p>
<p>Click "More" in the SPAMfighter Toolbar and select "Whitelist".</p>
<p>Here you can choose if you want to Whitelist the email addresses <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong> or the whole Domain.</p>
<p>To be sure that all emails from people in your Outlook contacts get through to you, you can import and Whitelist them.</p>
<p>To do this, follow these steps:</p>
<ol>
<li>- Click "More" in the SPAMfighter toolbar.</li>
<li>- Then "Options"</li>
<li>- Then "Filter settings"</li>
<li>- Then "Blacklists & Whitelists"</li>
<li>- Then "Whitelist email address"</li>
<li>- Then "Import".</li>
<li>- Select your 'Address Book' and click on "Check all"</li>
<li>- Click "Add"</li>
<li>- Click "Apply"</li>
</ol>
<p>If you get a pop-up box offering you to upgrade to SPAMfighter Pro, it is because you have exceeded the limit of 100 addresses. You can fix this by buying SPAMfighter Pro or by deleting some of the addresses in your Black/White list. If you want to delete addresses, please go to:</p>
<ol>
<li>- Click More" in the SPAMfighter toolbar.</li>
<li>- Then "Options"</li>
<li>- Then "Filter settings"</li>
<li>- Then "Blacklists & Whitelists"</li>
</ol>

<br />

<h2>MAIL WASHER</h2>
<ol>
<li>- Click Tools, then Blacklist & Friends.</li>
<li>- Click Add... on the right, the Friends list side.</li>
<li>- Make sure Plain email address is selected.</li>
<li>- Type: <strong>info@vnsh.com and customercare@vnsh.com</strong></li>
<li>- Click OK.</li>
<li>- Click OK.</li>
</ol>

<h2>CHOICEMAIL</h2>
<ol>
<li>- Open ChoiceMail</li>
<li>- Click on the Senders tab</li>
<li>- Choose "Approve another Sender"</li>
<li>- Type in the sender email address <strong>info@vnsh.com</strong> and <strong>customercare@vnsh.com</strong></li>
<li>- Click on OK</li>
</ol>

<br />

<h2>SPAM SLEUTH</h2>
<ol>
<li>- Select File, then Configure.</li>
<li>- Go to the Friends category.</li>
<li>- Make sure Active is checked.</li>
<li>- Type: <strong>info@vnsh.com/customercare@vnsh.com</strong> on a line by itself in the entry field.</li>
<li>- Click OK.</li>
</ol>

<p style="font-size: 14px; color: #666;">VNSH is in no way associated with any of the brands, websites or applications quoted here. All Trademarks ® are the property of their respective owners.</p>
<p style="font-size: 14px; color: #666;">Created with <a href="https://www.emaildeliveryjedi.com/email-whitelist.php" style="color: #007abd;">Email Whitelist</a> Generator v5.0</p>

<br />
<center>
<p><a href="/blogs/whitelist" style="color: #007abd;">Back to blog</a></p>
</center>
`;

export default WhitelistInstruction;

