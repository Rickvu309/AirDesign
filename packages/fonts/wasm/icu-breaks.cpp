#include <unicode/ubrk.h>
#include <unicode/uchar.h>
#include <unicode/udata.h>
#include <unicode/uscript.h>

extern "C" const unsigned char icudt77_dat[];

extern "C" int ad_init() {
  UErrorCode status = U_ZERO_ERROR;
  udata_setCommonData(icudt77_dat, &status);
  udata_setFileAccess(UDATA_ONLY_PACKAGES, &status);
  return U_FAILURE(status) ? status : 0;
}

extern "C" int ad_breaks(int type, const UChar* text, int length, const char* locale, int* offsets) {
  UErrorCode status = U_ZERO_ERROR;
  UBreakIterator* iterator = ubrk_open(static_cast<UBreakIteratorType>(type), locale, text, length, &status);
  if (U_FAILURE(status)) return -status;
  int count = 0;
  for (int pos = ubrk_first(iterator); pos != UBRK_DONE; pos = ubrk_next(iterator))
    offsets[count++] = pos;
  ubrk_close(iterator);
  return count;
}

extern "C" unsigned ad_script(int codepoint) {
  UErrorCode status = U_ZERO_ERROR;
  UScriptCode script = uscript_getScript(codepoint, &status);
  if (U_FAILURE(status) || script == USCRIPT_COMMON || script == USCRIPT_INHERITED) return 0;
  const char* tag = uscript_getShortName(script);
  return (tag[0] << 24) | (tag[1] << 16) | (tag[2] << 8) | tag[3];
}

extern "C" int ad_properties(int codepoint) {
  return u_hasBinaryProperty(codepoint, UCHAR_DEFAULT_IGNORABLE_CODE_POINT)
    | (u_hasBinaryProperty(codepoint, UCHAR_EMOJI) << 1)
    | (u_hasBinaryProperty(codepoint, UCHAR_EMOJI_PRESENTATION) << 2)
    | (u_hasBinaryProperty(codepoint, UCHAR_EXTENDED_PICTOGRAPHIC) << 3);
}
