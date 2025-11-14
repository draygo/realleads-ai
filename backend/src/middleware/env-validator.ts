// The ValidationResult interface defines the structure of the result returned by the validator.
// It includes a boolean 'valid' to indicate if all required environment variables are present,
// and an array of 'errors' containing error messages for missing variables.
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// An array listing the names of all required environment variables.
// These must be present and non-empty in process.env for validation to pass.
const REQUIRED_ENV_VARS: string[] = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_ANON_KEY',
  'ACCOUNT_ID_DEFAULT',
  'OPENAI_API_KEY',
  'ORCHESTRATOR_MODEL',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_MESSAGING_SERVICE_SID',
  'TWILIO_WHATSAPP_NUMBER',
  'MAILCHIMP_API_KEY',
  'MAILCHIMP_SERVER_PREFIX',
  'MAILCHIMP_AUDIENCE_ID_DEFAULT',
  'MANDRILL_API_KEY',
  'MANDRILL_FROM_MODE',
  'MANDRILL_FROM_EMAIL',
  'MANDRILL_REPLY_TO',
  'DIGEST_RECIPIENT_EMAIL',
  'APP_BASE_URL',
  'CORS_ORIGIN',
  'TIMEZONE',
];

// The validateEnv function checks that all required environment variables are set and non-empty.
// It returns a ValidationResult object with a boolean status and a list of error messages.
export function validateEnv(): ValidationResult {
  // Array to collect error messages about missing environment variables.
  const errors: string[] = [];

  // Iterate over each required environment variable.
  for (const varName of REQUIRED_ENV_VARS) {
    // Check if the variable is undefined, null, or an empty string in process.env
    if (
      typeof process.env[varName] === 'undefined' ||
      process.env[varName] === null ||
      process.env[varName] === ''
    ) {
      // Add an error message for any missing environment variable.
      errors.push(`Missing required environment variable: ${varName}`);
    }
  }

  // Return an object indicating if validation passed, and any errors found.
  return {
    valid: errors.length === 0,
    errors,
  };
}

