/**
 * Regex pattern for validating phone numbers from all Arab countries.
 *
 * Supported country codes:
 *  +20   Egypt           |  +212  Morocco         |  +213  Algeria
 *  +216  Tunisia         |  +218  Libya           |  +222  Mauritania
 *  +249  Sudan           |  +252  Somalia         |  +253  Djibouti
 *  +269  Comoros         |  +961  Lebanon         |  +962  Jordan
 *  +963  Syria           |  +964  Iraq            |  +965  Kuwait
 *  +966  Saudi Arabia    |  +967  Yemen           |  +968  Oman
 *  +970  Palestine       |  +971  UAE             |  +973  Bahrain
 *  +974  Qatar
 *
 * Format: optional "+" followed by an Arab country code, then 7-10 local digits.
 * Examples:  +201012345678 , 201012345678 , +966512345678 , +9715XXXXXXXX
 */
export const ARAB_PHONE_REGEX =
  /^\+?(20|212|213|216|218|222|249|252|253|269|961|962|963|964|965|966|967|968|970|971|973|974)\d{7,10}$/;

export const ARAB_PHONE_ERROR_MSG =
  "رقم الهاتف غير صحيح — يجب أن يبدأ بكود دولة عربية صحيح (مثال: +20 لمصر، +966 للسعودية)";
