import { i18n } from '@lingui/core';
import { messages } from '@/locales/en/messages';

const DEFAULT_LOCALE = 'en';

i18n.load(DEFAULT_LOCALE, messages);
i18n.activate(DEFAULT_LOCALE);

export { i18n };
