module.exports = {
  MODELS: {
    USER: "user",
    COMPANY_CONTACT: "company-contact",
    FILTER: "filter",
    CONFIGURATION: "configuration",
    EMAILS_SENT: "emails-sent",
    CAMPAIGN: "campaign",
    CAMPAIGN_RUN: "campaign-run",
    SEGMENT: "segment",
    TEMPLATE: "template",
    TEMPLATE_CATEGORY: "template-categories",
    DYNAMIC_TEMPLATE: "dynamic-template",
    CRON_JOB: "cron-job",
    COMPANY: "companies",
    ACCESS_TOKEN: "access-token",
    REFRESH_TOKEN: "refresh-token",
    ROLE: "role",
    SOCIAL_LINK: "social-link",
    ASSET: "asset",
    REFERRAL_CODE: "referral-code",
    REWARD: "reward",
    PLAN: "plan",
    OVERAGE_CONSUMPTION: "overage-comsumption",
    TOPUP: "topup",
  },

  RESPONSE_MESSAGES: {
    INVALID_TOKEN: "Not authenticated, invalid token provided!",
    TOKEN_IS_INVALID_OR_EXPIRED:
      "Not authenticated, token is invalid or expired!",
    TOKEN_IS_REQUIRED: "Not authenticated, token is required!",
    EMAIL_BELONGS_TO_OTHER: "This email address belongs to someone else!",
    USER_REGISTERED: "User registered successfully.",
    USER_LOGGED_IN: "User logged in successfully.",
    INVALID_EMAIL_OR_PASSWORD: "Invalid email or password!",
    TOO_MANY_INVALID_LOGIN_ATTEMTPS:
      "Too many invalid login attempts, your login with email has been locked temporarily, please login with your phone to continue.",
    FETCHED_CURRENT_USER: "Current user fetched successfully.",
    FETCHED_FILTER_KEYS: "Possible filter keys fetched successfully.",
    FETCHED_POSSIBLE_VALUES: "Possible filter values fetched successfully.",
    FETCHED_FILTER_COUNT: "Filter count fetched sucessfully.",
    SEARCH_SUCCESSFUL: "Searched successfully.",
    COMPANY_CONTACTS_FETCHED: "Company contacts fetched successfully.",
    FETCHED_ALL_COMPANY_CONTACTS: "All company contacts fetched successfully.",
    FILTER_ALREADY_EXISTS: "This filter already exists!",
    FILTER_CREATED: "Filter created successfully.",
    FILTER_UPDATED: "Filter updated successfully.",
    FILTER_FETCHED: "Filter fetched successfully.",
    FILTER_FETCHEDS: "Filters fetched successfully.",
    ALL_FILTERS_FETCHED: "All filters fetched successfully.",
    FILTER_DELETED: "Filter deleted successfully.",
    VERIFICATION_EMAIL_SENT:
      "A verification email has been sent to your email address.",
    EMAIL_VERIFIED: "Email address verified successfully.",
    EMAIL_NOT_VERIFIED: "Email address not verified yet!",
    INITIATED_DOMAIN_VERIFICATION:
      "Initiated domain verification, waiting for you to submit this information as TXT in your DNS records.",
    FETCHED_CONFIGURATION: "Configuration fetched successfully.",
    CONFIGURATION_NOT_FOUND: "No configurations found for this company!",
    DOMAIN_NOT_VERIFIED: "Domain not verified yet!",
    DOMAIN_VERIFIED: "Domain verified successfully.",
    INTERACTION_SUCCESSFULL: "Interaction successful.",
    DUPLICATE_CONFIGURATION: "Configuration exists already!",
    CONFIGURATION_CREATED: "Configuration created successfully.",
    DUPLICATE_DOMAIN: "This domain is already added!",
    DUPLICATE_EMAIL: "This email address is already added!",
    EMAIL_NOT_FOUND: "Email address not found!",
    DOMAIN_NOT_FOUND: "Domain not found!",
    EMAIL_DELETED: "Email address deleted successfully.",
    DOMAIN_DELETED: "Emai domain deleted successfully.",
    INVALID_EMAIL: "Invalid email address!",
    INVALID_DOMAIN: "Invalid domain!",
    EMAIL_ADDED_IN_DOMAIN: "Email added in the domain successfully.",
    VERIFIED_EMAIL_FETCHED: "Verified email addresses fetched successfully.",
    DUPLICATE_CAMPAIGN: "Campaign exists already!",
    CAMPAIGN_CREATED: "Campaign created successfully.",
    FETCHED_CAMPAIGN: "Campaign fetched successfully.",
    FETCHED_CAMPAIGNS: "Campaigns fetched successfully.",
    FETCHED_ALL_CAMPAIGNS: "All campaigns fetched successfully.",
    UPDATED_CAMPAIGN: "Campaign updated successfully.",
    DELETED_CAMPAIGN: "Campaign deleted successfully.",
    DUPLICATE_SEGMENT: "Segment exists already!",
    SEGMENT_NOT_FOUND: "Segment not found!",
    NO_SEGMENTS: "You do not have any segments!",
    SEGMENT_CREATED: "Segment created successfully.",
    FETCHED_ALL_SEGMENTS: "All segments fetched successfully.",
    FETCHED_SEGMENTS: "Segments fetched successfully.",
    FETCHED_SEGMENT: "Segment fetched successfully.",
    UPDATED_SEGMENT: "Segment updated successfully.",
    DELETED_SEGMENT: "Segment deleted successfully.",
    INVALID_SEGMENT_ID: "Invalid segment id!",
    DUPLICATE_TEMPLATE: "Template exists already!",
    INVALID_TEMPLATE_ID: "Invalid template id!",
    TEMPLATE_NOT_FOUND: "Template not found!",
    NO_TEMPLATES: "You do not have any templates!",
    TEMPLATE_CREATED: "Template created successfully.",
    FETCHED_TEMPLATE: "Template fetched successfully.",
    FETCHED_TEMPLATES: "Templates fetched successfully.",
    FETCHED_ALL_TEMPLATES: "All templates fetched successfully.",
    UPDATED_TEMPLATE: "Template updated successfully.",
    DELETED_TEMPLATE: "Template deleted successfully.",
    TEMPLATE_UPDATED_ALREADY: "Template updated already!",
    TEMPLATE_DELETED_ALREADY: "Template deleted already!",
    SEGMENT_UPDATED_ALREADY: "Segment updated already!",
    SEGMENT_DELETED_ALREADY: "Segment deleted already!",
    NO_CAMPAIGNS: "You do not have any campaigns!",
    CAMPAIGN_NOT_FOUND: "Campaign not found!",
    CAMPAIGN_UPDATED_ALREADY: "Campaign updated already!",
    CAMPAIGN_DELETED_ALREADY: "Campaign deleted already!",
    INVALID_CAMPAIGN_ID: "Invalid campaign id!",
    TEST_EMAIL_SENT: "Test email sent successfully.",
    COMPANY_CONTACT_DELETED_ALREADY: "Company contact deleted already!",
    COMPANY_CONTACTS_DELETED_ALREADY: "Company contacts deleted already!",
    COMPANY_USER_CREATED: "Company user created successfully.",
    COMPANY_USER_FETCHED: "Company user fetched successfully.",
    COMPANY_USERS_FETCHED: "Company users fetched successfully.",
    COMPANY_USER_UPDATED: "Company user updated successfully.",
    COMPANY_CONTACT_UPDATED: "Company contact updated successfully.",
    COMPANY_USER_DELETED: "Company user deleted successfully.",
    COMPANY_USERS_DELETED: "Company users deleted successfully.",
    COMPANY_CONTACT_DELETED: "Company contact deleted successfully.",
    COMPANY_DATA_RECEIVED: "Users recieved successfully.",
    INVALID_OBJECT_ID: "Invalid objectId!",
    USER_UPDATED: "User updated successfully.",
    ACCESS_TOKEN_CREATED: "Access token created successfully.",
    ACCESS_TOKEN_EXISTS: "Access token exists already!",
    ACCESS_TOKEN_NOT_FOUND: "Access token not found!",
    ACCESS_TOKEN_UPDATED: "Access token updated successfully.",
    ACCESS_TOKEN_UPDATED_ALREADY: "Access token updated already!",
    ACCESS_TOKEN_DELETED_ALREADY: "Access token deleted already!",
    FETCHED_ACCESS_TOKEN: "Access token fetched successfully.",
    FETCHED_ACCESS_TOKENS: "Access tokens fetched successfully.",
    ACCESS_TOKEN_DELETED: "Access token deleted successfully.",
    SETUP_INTENT_FETCHED: "Setup intent fetched successfully.",
    ROLE_EXISTS_ALREADY: "Role exists already!",
    ROLE_CREATED: "Role created successfully.",
    ALL_ROLES_FETCHED: "All roles fetched successfully.",
    ROLES_FETCHED: "Roles fetched successfully.",
    ROLE_FETCHED: "Role fetched successfully.",
    ROLE_NOT_FOUND: "Role not found!",
    ROLE_UPDATED: "Role updated successfully.",
    ROLE_DELETED: "Role deleted successfully.",
    SUBSCRIPTIONS_FETCHED: "Subscriptions fetched successfully.",
    SUBSCRIPTION_CREATED: "Subscription created successfully.",
    SOCIAL_LINK_EXISTS_ALREADY: "Social link exists already!",
    SOCIAL_LINK_NOT_FOUND: "Social link not found!",
    SOCIAL_LINK_CREATED: "Social link created successfully.",
    SOCIAL_LINK_FETCHED: "Social link fetched successfully.",
    SOCIAL_LINKS_FETCHED: "Social links fetched successfully.",
    ALL_SOCIAL_LINKS_FETCHED: "All social links fetched successfully.",
    SOCIAL_LINK_UPDATED: "Social link updated successfully.",
    SOCIAL_LINK_DELETED: "Social link deleted successfully.",
    ASSET_EXISTS_ALREADY: "Asset exists already!",
    ASSET_CREATED: "Asset created successfully.",
    ASSET_NOT_FOUND: "Asset not found!",
    ASSET_FETCHED: "Asset fetched successfully.",
    ASSETS_FETCHED: "Assets fetched successfully.",
    ALL_ASSETS_FETCHED: "All assets fetched successfully.",
    ASSET_UPDATED: "Asset updated successfully.",
    ASSET_DELETED: "Asset deleted successfully.",
    USER_CREATED: "User created successfully.",
    USER_EXISTS_ALREADY: "This email belongs to someone else in this company!",
    USERS_FETCHED: "Users fetched successfully.",
    ALL_USERS_FETCHED: "All users fetched successfully.",
    EMAIL_DOC_NOT_FOUND: "Email document not found!",
    USER_NOT_FOUND: "User not found!",
    USER_FETCHED: "User fetched successfully.",
    PASSWORD_INVALID: "Password is invalid!",
    PASSWORD_CHANGED: "Password changed successfully.",
    PASSWORD_RESET: "Password reset successfully.",
    TOKEN_VERIFIED: "Token verified successfully.",
    PASSWORD_RESET_REQUEST_SENT:
      "Password reset request has been sent. Please check your email to respond.",
    PASSWORD_DID_NOT_RESET: "Password did not reset, user not found!",
    ACTIVE_SUBSCRIPTION_NOT_FOUND:
      "No active subscription found for this customer!",
    DASHBOARD_DATA_FETCHED: "Dashboard data fetched successfully.",
    PAYMENT_METHOD_ATTACHED: "Payment method attached successfully.",
    INVITATION_EMAIL_SENT: "Invitation email sent successfully.",
    REFERRAL_CODE_ACCEPTED: "Referral code accepted.",
    CAMPAIGN_LOGS_FETCHED: "Campaign logs fetched successfully.",
    REFRESH_TOKEN_NOT_FOUND: "Refresh token not found!",
    REFRESH_TOKEN_INVALID: "Refresh is invalid or expired!",
    TOKEN_GENERATED: "Token generated successfully.",
    FETCHED_CAMPAIGN_RUNS: "Campaign runs fetched successfully.",
    FETCHED_CAMPAIGN_RUN_STATS: "Campaign run stats fetched successfully.",
    FETCHED_CAMPAIGN_RUN_EMAIL_SENT:
      "Campaign run emails sent fetched successfully.",
    INVALID_REFERRAL_CODE: "Referral code is invalid!",
    ADMIN_ROLE_NOT_ALLOWED: "Role 'Admin' can't be assigned!",
    REFERRAL_CODE_INPUT_LOCKED:
      "Too many invalid attempts, referral code input locked!",
    REWARD_CREATED: "Reward created successfully.",
    SUBSCRIPTION_UPDATED: "Subscription updated successfully.",
    TOP_UP_SUCCESSFULL: "Topped up successfully.",
    CUSTOMER_BALANCE_FETCHED: "Customer balance fetched successfully.",
    CUSTOMER_BALANCE_HISTORY_FETCHED:
      "Customer balance history fetched successfully.",
    EMAIL_LIMIT_REACHED:
      "Email sending limit reached for your current subscription!",
    BANDWIDTH_LIMIT_REACHED:
      "Email content limit reached for your current subscription!",
    INVOICES_FETCHED: "Invoices fetched successfully.",
    RECEIPTS_FETCHED: "Receipts fetched successfully.",
    DEFAULT_PAYMENT_METHOD_FETCHED:
      "Default payment method fetched successfully.",
    DEFAULT_PAYMENT_METHOD_MISSING: "Default payment method not found!",
    FETCHED_ALL_TEMPLATE_CATEGORIES: "Fetched all template categories.",
    FETCHED_TEMPLATE_CATEGORIES: "Fetched template categories.",
    FETCHED_TEMPLATE_CATEGORY: "Fetched template category.",
    PRIMARY_KEY_CREATED: "Primary key created successfully.",
    PRIMARY_KEY_NOT_FOUND: "Primary key not found!",
    PRIMARY_KEY_FETCHED: "Primary key fetched successfully.",
    PRIMARY_KEY_UPDATED: "Primary key updated successfully.",
    PRIMARY_KEY_DELETED: "Primary key deleted successfully.",
    QUOTA_DETAILS_FETCHED: "Quota details fetched successully.",
    PLANS_FETCHED: "Plans fetched successfully.",
    ACTIVE_PLAN_NOT_FOUND: "No active plan found!",
    NO_RIGHTS: "You don't have rights to perform this action!",
    COMPANY_CONTACTS_ADDED: "Company contacts added successfully.",
    COMPANY_CONTACT_CREATED: "Company contact created successfully.",
    COMPANY_CONTACT_NOT_FOUND: "Company contact not found!",
    COMPANY_CONTACT_FETCHED: "Company contact fetched successfully.",
    CAMPAIGN_USAGE_DETAILS_FETCHED:
      "Campaign usage details fetched successfully.",
    FILTER_VALUES_REQUIRED: "Filter values are required!",
  },

  INTERACTION_CHANNELS: {
    EMAIL: "EMAIL",
    SMS: "SMS",
    WHATSAPP: "WHATSAPP",
    PUSH_NOTIFICATION: "PUSH_NOTIFICATION",
    IN_APP_MESSAGE: "IN_APP_MESSAGE",
  },

  FILTER_TYPES: {
    INPUT: "INPUT",
    DROP_DOWN: "DROP_DOWN",
    RADIO: "RADIO",
    CHECK_BOX: "CHECK_BOX",
    RANGE_SLIDER: "RANGE_SLIDER",
  },

  DOCUMENT_STATUS: {
    ACTIVE: "ACTIVE",
    ARCHIVED: "ARCHIVED",
    DELETED: "DELETED",
  },

  TEMPLATE_KINDS: {
    REGULAR: "REGULAR",
    SAMPLE: "SAMPLE",
  },

  TEMPLATE_CONTENT_TYPE: {
    TEXT: "TEXT",
    HTML: "HTML",
  },

  RUN_MODE: {
    INSTANT: "INSTANT",
    SCHEDULE: "SCHEDULE",
  },

  CRON_STATUS: {
    PENDING: "PENDING",
    PROCESSING: "PROCESSING",
    PROCESSED: "PROCESSED",
  },

  CRON_RECORD_LIMIT: 30,

  CRON_JOBS: {
    RUN_CAMPAIGN: "RUN_CAMPAIGN",
  },

  CRON_INTERVALS: {
    ["1M"]: "1 minute",
  },

  CRON_RECORD_LIMIT: 30,

  ENVIRONMENT: {
    LOCAL: "LOCAL",
    STAGING: "STAGING",
    PRODUCTION: "PRODUCTION",
  },

  VERIFICATION_EMAIL_SUBJECT: "Public Circles Email Verification",

  ROLE_STATUS: {
    ACTIVE: "ACTIVE",
    ARCHIVED: "ARCHIVED",
    DELETED: "DELETED",
  },

  SOCIAL_LINK_STATUS: {
    ACTIVE: "ACTIVE",
    ARCHIVED: "ARCHIVED",
    DELETED: "DELETED",
  },

  ASSETS_STATUS: {
    ACTIVE: "ACTIVE",
    ARCHIVED: "ARCHIVED",
    DELETED: "DELETED",
  },

  CAMPAIGN_STATUS: {
    ACTIVE: "ACTIVE",
    DISABLED: "DISABLED",
    DELETED: "DELETED",
  },

  FILTER_STATUS: {
    ACTIVE: "ACTIVE",
    ARCHIVED: "ARCHIVED",
    DELETED: "DELETED",
  },

  SEGMENT_STATUS: {
    ACTIVE: "ACTIVE",
    ARCHIVED: "ARCHIVED",
    DELETED: "DELETED",
  },

  TEMPLATE_STATUS: {
    ACTIVE: "ACTIVE",
    ARCHIVED: "ARCHIVED",
    DELETED: "DELETED",
  },

  TEMPLATE_CATEGORY_STATUS: {
    ACTIVE: "ACTIVE",
    ARCHIVED: "ARCHIVED",
    DELETED: "DELETED",
  },

  ACCESS_TOKEN_STATUS: {
    ACTIVE: "ACTIVE",
    DELETED: "DELETED",
  },

  USER_STATUS: {
    ACTIVE: "ACTIVE",
    SUSPENDED: "SUSPENDED",
    DELETED: "DELETED",
  },

  PASSWORD_RESET_SUBJECT: "We recieved a request to reset your password.",

  PASSWORD_RESET_CONTENT: `<!DOCTYPE html><html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="en"><head><title></title><meta http-equiv="Content-Type" content="text/html; charset=utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch><o:AllowPNG/></o:OfficeDocumentSettings></xml><![endif]--><style>
*{box-sizing:border-box}body{margin:0;padding:0}a[x-apple-data-detectors]{color:inherit!important;text-decoration:inherit!important}#MessageViewBody a{color:inherit;text-decoration:none}p{line-height:inherit}.desktop_hide,.desktop_hide table{mso-hide:all;display:none;max-height:0;overflow:hidden}.image_block img+div{display:none}sub,sup{font-size:75%;line-height:0} @media (max-width:520px){.mobile_hide{display:none}.row-content{width:100%!important}.stack .column{width:100%;display:block}.mobile_hide{min-height:0;max-height:0;max-width:0;overflow:hidden;font-size:0}.desktop_hide,.desktop_hide table{display:table!important;max-height:none!important}}
</style><!--[if mso ]><style>sup, sub { font-size: 100% !important; } sup { mso-text-raise:10% } sub { mso-text-raise:-10% }</style> <![endif]--></head><body class="body" style="background-color:#fff;margin:0;padding:0;-webkit-text-size-adjust:none;text-size-adjust:none"><table class="nl-container" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0;background-color:#fff"><tbody><tr><td><table class="row row-1" align="center" 
width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0"><tbody><tr><td><table class="row-content stack" align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0;color:#000;width:500px;margin:0 auto" width="500"><tbody><tr><td class="column column-1" width="100%" 
style="mso-table-lspace:0;mso-table-rspace:0;font-weight:400;text-align:left;border-bottom:0 solid transparent;border-left:0 solid transparent;border-right:0 solid transparent;border-top:0 solid transparent;padding-bottom:5px;padding-top:5px;vertical-align:top"><table class="heading_block block-1" width="100%" border="0" cellpadding="0" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0"><tr><td class="pad" style="text-align:center;width:100%"><h1 
style="margin:0;color:#555;direction:ltr;font-family:Arial,Helvetica Neue,Helvetica,sans-serif;font-size:23px;font-weight:700;letter-spacing:normal;line-height:120%;text-align:center;margin-top:0;margin-bottom:0;mso-line-height-alt:27.599999999999998px"><span class="tinyMce-placeholder" style="word-break: break-word;">Public Circles</span></h1></td></tr></table><table class="paragraph_block block-2" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" 
style="mso-table-lspace:0;mso-table-rspace:0;word-break:break-word"><tr><td class="pad"><div style="color:#000;direction:ltr;font-family:Arial,Helvetica Neue,Helvetica,sans-serif;font-size:14px;font-weight:400;letter-spacing:0;line-height:120%;text-align:left;mso-line-height-alt:16.8px"><p style="margin:0;margin-bottom:16px">Hi {{firstName}},</p><p style="margin:0;margin-bottom:16px">
We received a request to reset your password. To proceed, simply click the button below.</p><p style="margin:0">&nbsp;</p></div></td></tr></table><table class="button_block block-3" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" style="mso-table-lspace:0;mso-table-rspace:0"><tr><td class="pad"><div class="alignment" align="center"><a href="{{reset-url}}" target="_blank" style="color:#ffffff;"><!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"  href="{{reset-url}}"  style="height:38px;width:141px;v-text-anchor:middle;" arcsize="11%" fillcolor="#3AAEE0">
<v:stroke dashstyle="Solid" weight="0px" color="#3AAEE0"/>
<w:anchorlock/>
<v:textbox inset="0px,0px,0px,0px">
<center dir="false" style="color:#ffffff;font-family:sans-serif;font-size:14px">
<![endif]--><div style="background-color:#3aaee0;border-bottom:0 solid transparent;border-left:0 solid transparent;border-radius:4px;border-right:0 solid transparent;border-top:0 solid transparent;color:#fff;display:inline-block;font-family:Arial,Helvetica Neue,Helvetica,sans-serif;font-size:14px;font-weight:400;mso-border-alt:none;padding-bottom:5px;padding-top:5px;text-align:center;text-decoration:none;width:auto;word-break:keep-all">
<span style="word-break: break-word; padding-left: 20px; padding-right: 20px; font-size: 14px; display: inline-block; letter-spacing: normal;"><span style="word-break: break-word; line-height: 28px;">Reset Password</span></span></div><!--[if mso]></center></v:textbox></v:roundrect><![endif]--></a></div></td></tr></table><table class="paragraph_block block-4" width="100%" border="0" cellpadding="10" cellspacing="0" role="presentation" 
style="mso-table-lspace:0;mso-table-rspace:0;word-break:break-word"><tr><td class="pad"><div style="color:#000;direction:ltr;font-family:Arial,Helvetica Neue,Helvetica,sans-serif;font-size:14px;font-weight:400;letter-spacing:0;line-height:120%;text-align:left;mso-line-height-alt:16.8px"><p style="margin:0;margin-bottom:16px">&nbsp;</p><p style="margin:0;margin-bottom:16px">Having troubles? Just copy and paste this link into your browser:</p><p style="margin:0;margin-bottom:16px">
<a href="{{reset-url}}" target="_blank" style="text-decoration: underline; color: #0068A5;" rel="noopener">{{reset-url}}</a></p><p style="margin:0;margin-bottom:16px">If you didn't make this request, no further action is required.</p><p style="margin:0">Thank you,<br>Public Circles team</p></div></td></tr></table></td></tr></tbody></table></td></tr></tbody></table></td></tr></tbody></table><!-- End --></body></html>`,

  GRAPH_SCOPES: {
    YEAR: "YEAR",
    MONTH: "MONTH",
    WEEK: "WEEK",
    DAY: "DAY",
  },

  EMAIL_KIND: {
    REGULAR: "REGULAR",
    TEST: "TEST",
    VERIFICATION: "VERIFICATION",
    PASSWORD_RESET: "PASSWORD_RESET",
    INVITATION: "INVITATION",
  },

  USER_KIND: {
    PRIMARY: "PRIMARY",
    SECONDARY: "SECONDARY",
  },

  REWARD_KIND: {
    TRIAL: "TRIAL",
    FIXED_DISCOUNT: "FIXED_DISCOUNT",
    PERCENTAGE_DISCOUNT: "PERCENTAGE_DISCOUNT",
  },

  OVERAGE_KIND: {
    CONTACT: "CONTACT",
  },

  CURRENCY: {
    CAD: "cad",
  },

  SORT_ORDER: {
    ASC: "ASC",
    DSC: "DSC",
  },

  SOCKET_CHANNELS: {
    CONTACTS_UPLOAD_PROGRESS: "CONTACTS_UPLOAD_PROGRESS",
  },
};
