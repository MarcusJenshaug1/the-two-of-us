import { nb } from 'date-fns/locale/nb'
import { enUS } from 'date-fns/locale/en-US'
import type { Locale } from 'date-fns'

/**
 * Returns the date-fns locale object matching the app's i18n locale.
 * Use with format(): format(date, 'MMMM yyyy', { locale: getDateLocale(locale) })
 */
export function getDateLocale(appLocale: string): Locale {
    return appLocale === 'no' ? nb : enUS
}
