"use client";
import { useEffect, useState } from "react";
import { Droplets, Users, CheckCircle, Activity } from "lucide-react";
import { fetchDonorImpact, type DonorImpactSummary } from "@/lib/api/donorImpact.api";

export default function DonorImpactDashboard({ donorId }: { donorId: string }) {
  const [data, setData] = useState<DonorImpactSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDonorImpact(donorId)
      .then(setData)
      .catch(() => setError("Failed to load impact data"))
      .finally(() => setLoading(false));
  }, [donorId]);

  if (loading) return <div className="p-6 text-center text-gray-500">Loading…</div>;
  if (error) return <div className="p-6 text-center text-red-500">{error}</div>;
  if (!data) return null;

  const cards = [
    { label: "Total Donations", value: data.totalDonations, icon: Droplets, color: "text-red-600 bg-red-50" },
    { label: "ml Donated", value: data.totalMlDonated.toLocaleString(), icon: Activity, color: "text-blue-600 bg-blue-50" },
    { label: "Requests Fulfilled", value: data.requestsFulfilled, icon: CheckCircle, color: "text-green-600 bg-green-50" },
    { label: "Patients Supported (est.)", value: data.estimatedPatientsSupported, icon: Users, color: "text-purple-600 bg-purple-50" },
  ];

  return (
    <div className="space-y-6 font-poppins">
      <div>
        <h2 className="text-xl font-bold text-black">Your Impact</h2>
        <p className="text-sm text-gray-500">Donor ref: {data.donorRef}</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.color}`}>
              <c.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{c.label}</p>
              <p className="text-2xl font-semibold text-black">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-5">
        <h3 className="font-semibold text-sm text-gray-700 mb-4">Contribution History</h3>
        {data.timeline.length === 0 ? (
          <p className="text-sm text-gray-400">No activity yet.</p>
        ) : (
          <ul className="space-y-3">
            {data.timeline.map((event, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${event.type === "donation" ? "bg-red-500" : "bg-green-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{event.description}</p>
                  <p className="text-xs text-gray-400">{new Date(event.date).toLocaleDateString()}</p>
                  {event.onChainRef && (
                    <p className="text-xs text-blue-500 truncate" title={event.onChainRef}>
                      On-chain: {event.onChainRef.slice(0, 16)}…
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
