import { Check, CheckCheck, Clock } from "lucide-react";

interface NomadThreadReceiptProps {
  status: "sending" | "queued" | "sent" | "delivered" | "read" | "failed";
  timestamp: Date;
}

const NomadThreadReceipt = ({ status, timestamp }: NomadThreadReceiptProps) => {
  const config = {
    sending: { icon: Clock, color: "text-muted-foreground/30", label: "Sending" },
    queued: { icon: Clock, color: "text-muted-foreground/30", label: "Queued" },
    sent: { icon: Check, color: "text-muted-foreground/40", label: "Sent" },
    delivered: { icon: CheckCheck, color: "text-muted-foreground/50", label: "Delivered" },
    read: { icon: CheckCheck, color: "text-foreground/50", label: "Read" },
    failed: { icon: Clock, color: "text-destructive/60", label: "Failed" },
  };

  const { icon: Icon, color, label } = config[status] || config.sent;

  return (
    <div className={`flex items-center gap-1 text-[8px] font-extralight ${color}`}>
      <Icon className="h-2.5 w-2.5" />
      <span>{timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
    </div>
  );
};

export default NomadThreadReceipt;
