import { TicketForm } from "@/components/ticket/ticket-form";

export const metadata = {
  title: "New Ticket — Manilal Ticket System",
};

export default function NewTicketPage() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-neutral-50">
            Raise a Ticket
          </h1>
          <p className="mt-1 text-sm text-neutral-400">
            Describe your issue in detail. Your ticket will be added to the
            backlog.
          </p>
        </div>
        <TicketForm />
      </div>
    </div>
  );
}
