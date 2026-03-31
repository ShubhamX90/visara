"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { exportSettings, mockCurrentUser, notificationSettings } from "@/lib/mock-data";
import type { SettingToggle } from "@/lib/types";

function togglePreference(items: SettingToggle[], id: string) {
  return items.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item));
}

export function SettingsPageClient() {
  const [notificationPrefs, setNotificationPrefs] = useState(notificationSettings);
  const [exportPrefs, setExportPrefs] = useState(exportSettings);
  const [passwordState, setPasswordState] = useState({
    current: "",
    next: "",
    confirm: ""
  });
  const [saveMessage, setSaveMessage] = useState("Preferences shown below are populated with realistic clinical workflow defaults.");

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <Card className="glass-panel border border-white/50">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-2xl font-semibold text-slate-950">User profile</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
                <p className="text-sm text-slate-500">Name</p>
                <p className="mt-1 font-semibold text-slate-950">{mockCurrentUser.name}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
                <p className="text-sm text-slate-500">Role</p>
                <p className="mt-1 font-semibold text-slate-950">{mockCurrentUser.role}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
                <p className="text-sm text-slate-500">Email</p>
                <p className="mt-1 font-semibold text-slate-950">{mockCurrentUser.email}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
                <p className="text-sm text-slate-500">Institution</p>
                <p className="mt-1 font-semibold text-slate-950">{mockCurrentUser.institution}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border border-white/50">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-2xl font-semibold text-slate-950">Notification preferences</h2>
            <div className="space-y-3">
              {notificationPrefs.map((preference) => (
                <div className="flex items-start justify-between gap-4 rounded-[24px] border border-slate-200 bg-white/80 p-4" key={preference.id}>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-950">{preference.label}</p>
                    <p className="text-sm leading-7 text-slate-600">{preference.description}</p>
                  </div>
                  <Switch checked={preference.enabled} onCheckedChange={() => setNotificationPrefs((current) => togglePreference(current, preference.id))} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <Card className="glass-panel border border-white/50">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-2xl font-semibold text-slate-950">Export preferences</h2>
            <div className="space-y-3">
              {exportPrefs.map((preference) => (
                <div className="flex items-start justify-between gap-4 rounded-[24px] border border-slate-200 bg-white/80 p-4" key={preference.id}>
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-950">{preference.label}</p>
                    <p className="text-sm leading-7 text-slate-600">{preference.description}</p>
                  </div>
                  <Switch checked={preference.enabled} onCheckedChange={() => setExportPrefs((current) => togglePreference(current, preference.id))} />
                </div>
              ))}
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
              <label className="text-sm font-medium text-slate-700" htmlFor="template-style">
                PDF template style
              </label>
              <select className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" defaultValue="clinical-standard" id="template-style">
                <option value="clinical-standard">Clinical standard</option>
                <option value="research-appendix">Clinical standard with research appendix</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border border-white/50">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-2xl font-semibold text-slate-950">Password change</h2>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="current-password">
                  Current password
                </label>
                <Input
                  id="current-password"
                  onChange={(event) => setPasswordState((current) => ({ ...current, current: event.target.value }))}
                  placeholder="Enter current password"
                  type="password"
                  value={passwordState.current}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="next-password">
                  New password
                </label>
                <Input
                  id="next-password"
                  onChange={(event) => setPasswordState((current) => ({ ...current, next: event.target.value }))}
                  placeholder="Enter a new password"
                  type="password"
                  value={passwordState.next}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700" htmlFor="confirm-password">
                  Confirm new password
                </label>
                <Input
                  id="confirm-password"
                  onChange={(event) => setPasswordState((current) => ({ ...current, confirm: event.target.value }))}
                  placeholder="Re-enter the new password"
                  type="password"
                  value={passwordState.confirm}
                />
              </div>
            </div>
            <Button onClick={() => setSaveMessage("Settings were updated in the local review state.")} type="button">
              Save preferences
            </Button>
            <p className="text-sm leading-7 text-slate-600">{saveMessage}</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
