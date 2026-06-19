import { Button } from "@lets_work/ui/components/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@lets_work/ui/components/carousel";
import { Card, CardContent } from "@lets_work/ui/components/card";
import type { ReactNode } from "react";

type ProfileItemsCarouselProps<T extends { id: string }> = {
  items: T[];
  emptyMessage: string;
  onRemove: (id: string) => void;
  renderCard: (item: T) => ReactNode;
};

export function ProfileItemsCarousel<T extends { id: string }>({
  items,
  emptyMessage,
  onRemove,
  renderCard,
}: ProfileItemsCarouselProps<T>) {
  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <Carousel
      opts={{
        align: "start",
      }}
      className="w-full"
    >
      <CarouselContent className="-ml-3">
        {items.map((item) => (
          <CarouselItem key={item.id} className="basis-full pl-3 sm:basis-1/2 lg:basis-1/3">
            <Card className="h-full overflow-hidden">
              <CardContent className="flex h-full flex-col gap-3 p-4">
                {renderCard(item)}
                <div className="mt-auto flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => onRemove(item.id)}
                  >
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      {items.length > 1 ? (
        <div className="mt-3 flex justify-end gap-2">
          <CarouselPrevious className="static translate-y-0" />
          <CarouselNext className="static translate-y-0" />
        </div>
      ) : null}
    </Carousel>
  );
}

export function PortfolioCarouselCard({
  title,
  description,
  imageUrl,
  projectUrl,
}: {
  title: string;
  description: string | null;
  imageUrl: string | null;
  projectUrl: string | null;
}) {
  return (
    <>
      {imageUrl ? (
        <img src={imageUrl} alt={title} className="aspect-video w-full object-cover" />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-muted text-xs text-muted-foreground">
          No preview image
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="font-medium leading-snug">{title}</p>
        {description ? (
          <p className="line-clamp-3 text-sm text-muted-foreground">{description}</p>
        ) : null}
        {projectUrl ? (
          <a
            href={projectUrl}
            target="_blank"
            rel="noreferrer"
            className="w-fit text-xs text-primary underline underline-offset-2 hover:text-primary/80"
          >
            View project
          </a>
        ) : null}
      </div>
    </>
  );
}

export function CertificationCarouselCard({
  name,
  issuer,
  imageUrl,
}: {
  name: string;
  issuer: string | null;
  imageUrl: string | null;
}) {
  return (
    <>
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
          No certificate image
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="font-medium leading-snug">{name}</p>
        {issuer ? <p className="text-sm text-muted-foreground">{issuer}</p> : null}
      </div>
    </>
  );
}

export function ExperienceCarouselCard({
  title,
  company,
  description,
  startDate,
  endDate,
  isCurrent,
}: {
  title: string;
  company: string | null;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
}) {
  const formatDate = (value: string | null) => {
    if (!value) return null;
    return new Date(value).toLocaleDateString(undefined, { month: "short", year: "numeric" });
  };

  const start = formatDate(startDate);
  const end = isCurrent ? "Present" : formatDate(endDate);

  return (
    <div className="flex min-h-48 flex-col gap-2">
      <p className="font-medium leading-snug">{title}</p>
      {company ? <p className="text-sm text-muted-foreground">{company}</p> : null}
      {start || end ? (
        <p className="text-xs text-muted-foreground">
          {start ?? "—"}
          {start || end ? " – " : ""}
          {end ?? "—"}
        </p>
      ) : null}
      {description ? (
        <p className="line-clamp-4 text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  );
}
