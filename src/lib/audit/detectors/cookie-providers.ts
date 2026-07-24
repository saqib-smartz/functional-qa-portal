export interface CookieProviderFingerprint {
  slug: string;
  name: string;
  containerSelector: string;
  acceptSelector: string;
  rejectSelector: string;
  preferencesSelector: string;
}

export const COOKIE_PROVIDERS: CookieProviderFingerprint[] = [
  {
    slug: "cookieyes",
    name: "CookieYes",
    containerSelector: "#cookieyes, .cky-consent-container",
    acceptSelector: "#cky-btn-accept, .cky-btn-accept",
    rejectSelector: "#cky-btn-reject, .cky-btn-reject",
    preferencesSelector: "#cky-btn-preferences, .cky-btn-preferences",
  },
  {
    slug: "complianz",
    name: "Complianz",
    containerSelector: "#cmplz-cookiebanner-container, .cmplz-cookiebanner",
    acceptSelector: ".cmplz-accept, .cmplz-btn-accept",
    rejectSelector: ".cmplz-deny, .cmplz-btn-deny",
    preferencesSelector: ".cmplz-manage-options, .cmplz-btn-manage-options",
  },
  {
    slug: "cookiebot",
    name: "Cookiebot",
    containerSelector: "#CybotCookiebotDialog",
    acceptSelector: "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll, #CybotCookiebotDialogBodyButtonAccept",
    rejectSelector: "#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll, #CybotCookiebotDialogBodyButtonDecline",
    preferencesSelector: "#CybotCookiebotDialogBodyLevelButtonCustomize",
  },
  {
    slug: "onetrust",
    name: "OneTrust",
    containerSelector: "#onetrust-banner-sdk",
    acceptSelector: "#onetrust-accept-btn-handler",
    rejectSelector: "#onetrust-reject-all-handler",
    preferencesSelector: "#onetrust-pc-btn-handler",
  },
];

/** Generic fallback for custom/in-house cookie banner implementations. */
export const CUSTOM_COOKIE_BANNER_HINTS = {
  containerSelector:
    "[class*='cookie-banner' i], [class*='cookie-consent' i], [id*='cookie-banner' i], [id*='cookie-consent' i]",
  acceptTextPattern: /accept|agree|allow|got it|ok\b/i,
  rejectTextPattern: /reject|decline|deny|refuse/i,
  preferencesTextPattern: /preferences|settings|customi[sz]e|manage/i,
};
