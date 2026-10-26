import { getLocale } from "next-intl/server";
import FinanceHub from "@/components/pages/finance-hub";

interface FinancePageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const { tab } = await searchParams;
  const locale = await getLocale();

  return (
    <FinanceHub
      language={locale as "ar" | "en"}
      initialTab={tab || "invoices"}
    />
  );
}
