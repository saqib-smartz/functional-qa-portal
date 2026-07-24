export interface FormPluginFingerprint {
  slug: string;
  name: string;
  /** matched against raw page HTML to decide whether this plugin is present at all */
  match: (html: string) => boolean;
  /** CSS selector used to locate individual form instances of this plugin on the page */
  formSelector: string;
  /** selector(s) that appear near/inside the form once a submission succeeds */
  successSelector: string;
  /** selector(s) that appear near/inside the form once a submission is rejected (validation errors) */
  errorSelector: string;
}

export const FORM_PLUGINS: FormPluginFingerprint[] = [
  {
    slug: "contact-form-7",
    name: "Contact Form 7",
    match: (html) => /\bwpcf7\b/i.test(html),
    formSelector: "form.wpcf7-form",
    successSelector: ".wpcf7-mail-sent-ok, [role='status'].wpcf7-mail-sent-ok",
    errorSelector: ".wpcf7-validation-errors, .wpcf7-not-valid-tip, .wpcf7-response-output.wpcf7-mail-sent-ng",
  },
  {
    slug: "wpforms",
    name: "WPForms",
    match: (html) => /\bwpforms-form\b/i.test(html),
    formSelector: "form.wpforms-form",
    successSelector: ".wpforms-confirmation-container, .wpforms-confirmation-scroll",
    errorSelector: ".wpforms-error, .wpforms-field-required-error",
  },
  {
    slug: "gravity-forms",
    name: "Gravity Forms",
    match: (html) => /\bgform_wrapper\b/i.test(html),
    formSelector: "form[id^='gform_']",
    successSelector: ".gform_confirmation_message",
    errorSelector: ".gfield_validation_message, .validation_error, .gform_validation_errors",
  },
  {
    slug: "fluent-forms",
    name: "Fluent Forms",
    match: (html) => /\bfluentform\b/i.test(html),
    formSelector: "form.frm-fluent-form, form.fluentform",
    successSelector: ".ff-message-success, .frm_success_message",
    errorSelector: ".error.text-danger, .ff-el-is-error",
  },
  {
    slug: "elementor-forms",
    name: "Elementor Forms",
    match: (html) => /\belementor-form\b/i.test(html),
    formSelector: "form.elementor-form",
    successSelector: ".elementor-message-success",
    errorSelector: ".elementor-message-danger, .elementor-field-group .elementor-message",
  },
  {
    slug: "kadence-forms",
    name: "Kadence Forms",
    match: (html) => /\bkb-forms-form\b/i.test(html) || /\bkadence-form\b/i.test(html),
    formSelector: "form.kb-forms-form, form.kadence-form",
    successSelector: ".kb-form-success-msg, .kadence-form-success",
    errorSelector: ".kb-form-error-msg, .kadence-form-error",
  },
  {
    slug: "ninja-forms",
    name: "Ninja Forms",
    match: (html) => /\bnf-form-wrap\b/i.test(html),
    formSelector: ".nf-form-wrap form",
    successSelector: ".nf-response-msg",
    errorSelector: ".nf-error-msg, .ninja-forms-req-symbol + .nf-error",
  },
];

export function detectFormPlugins(html: string): FormPluginFingerprint[] {
  return FORM_PLUGINS.filter((plugin) => plugin.match(html));
}
