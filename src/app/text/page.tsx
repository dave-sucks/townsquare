"use client";

import { useState } from "react";
import { AppShell, PageHeader } from "@/components/layout";
import { useAuth } from "@/hooks/use-auth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FONTS = [
  { value: "font-sans", label: "Host Grotesk (default)" },
  { value: "font-brand", label: "Tuffy (brand)" },
  { value: "font-schibsted", label: "Schibsted Grotesk" },
  { value: "font-cal-sans", label: "Cal Sans" },
  { value: "font-elms-sans", label: "Elms Sans" },
  { value: "font-google-sans", label: "Google Sans" },
  { value: "font-google-sans-flex", label: "Google Sans Flex" },
  { value: "font-mozilla-text", label: "Mozilla Text" },
  { value: "font-nata-sans", label: "Nata Sans" },
  { value: "font-oranienbaum", label: "Oranienbaum" },
];

const SAMPLE_TEXT_LONG = `No one shall be subjected to arbitrary arrest, detention or exile. Everyone is entitled in full equality to a fair and public hearing by an independent and impartial tribunal, in the determination of his rights and obligations and of any criminal charge against him. No one shall be subjected to arbitrary interference with his privacy, family, home or correspondence, nor to attacks upon his honour and reputation. Everyone has the right to the protection of the law against such interference or attacks.`;

const SAMPLE_TEXT_SHORT = `Whereas a common understanding of these rights and freedoms is`;

const SAMPLE_TEXT_MED = `No one shall be held in slavery or servitude; slavery and the slave trade shall be prohibited in all their forms.`;

const SAMPLE_TEXT_LONG2 = `Everyone has the right to an effective remedy by the competent national tribunals for acts violating the fundamental rights granted him by the constitution or by law.`;

export default function TextPage() {
  const { user } = useAuth();
  const [selectedFont, setSelectedFont] = useState("font-sans");

  return (
    <AppShell user={user}>
      <PageHeader title="Font Tester" />
      <div className="flex-1 overflow-y-auto">
        <div className="container max-w-4xl py-6 px-4">
          <div className="mb-8">
            <Select value={selectedFont} onValueChange={setSelectedFont}>
              <SelectTrigger className="w-[220px]" data-testid="select-font">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONTS.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={`space-y-8 ${selectedFont}`}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Regular 400 at 48px</p>
                  <p className="text-5xl leading-tight">
                    {SAMPLE_TEXT_SHORT}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Regular 400 at 36px</p>
                  <p className="text-4xl leading-tight">
                    {SAMPLE_TEXT_MED}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Regular 400 at 32px</p>
                  <p className="text-3xl leading-snug">
                    {SAMPLE_TEXT_LONG2}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Regular 400 at 21px</p>
                  <p className="text-xl leading-relaxed">
                    {SAMPLE_TEXT_LONG}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-2">Regular 400 at 16px</p>
                  <p className="text-base leading-relaxed">
                    {SAMPLE_TEXT_LONG}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
