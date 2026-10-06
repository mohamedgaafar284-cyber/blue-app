import { getLocale } from 'next-intl/server';
import FieldPortalPage from '@/components/pages/field-portal';

export const metadata = {
  title: 'بوابة المهندس الميداني (Field Portal) | BluePrint',
  description: 'واجهة سريعة ومخصصة لمهندسي الموقع: تسجيل الزيارات، فحص العيوب، والمساعد الصوتي بالذكاء الاصطناعي',
};

export default async function FieldPortalRoute() {
  const locale = await getLocale();
  return <FieldPortalPage language={locale as 'ar' | 'en'} />;
}
