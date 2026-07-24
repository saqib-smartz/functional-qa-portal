import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ExecutiveSummary({ summary }: { summary: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Executive Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{summary}</p>
      </CardContent>
    </Card>
  );
}
