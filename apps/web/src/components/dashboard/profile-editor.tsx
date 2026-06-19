import { Button } from "@lets_work/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@lets_work/ui/components/field";
import { Input } from "@lets_work/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@lets_work/ui/components/select";
import { Separator } from "@lets_work/ui/components/separator";
import { Textarea } from "@lets_work/ui/components/textarea";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import {
  AVAILABILITY_OPTIONS,
  COUNTRIES,
  CURRENCIES,
  getTimezoneOptions,
  SKILL_SUGGESTIONS,
} from "@/lib/profile-options";
import { profileApi, type ProfileBundle } from "@/lib/profile-api";

import { MediaUploadDropzone, MediaUploadField } from "./media-upload-field";
import {
  CertificationCarouselCard,
  ExperienceCarouselCard,
  PortfolioCarouselCard,
  ProfileItemsCarousel,
} from "./profile-items-carousel";
import { SearchableCombobox } from "./searchable-combobox";
import { SkillsTagsInput } from "./skills-tags-input";

const inputClassName = "h-10";

function resolveCountryValue(stored: string | null | undefined) {
  if (!stored) return "";
  if (COUNTRIES.some((country) => country.value === stored)) return stored;
  const byLabel = COUNTRIES.find(
    (country) => country.label.toLowerCase() === stored.toLowerCase(),
  );
  return byLabel?.value ?? stored;
}

export default function ProfileEditor() {
  const router = useRouter();
  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);

  const [data, setData] = useState<ProfileBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [availabilityStatus, setAvailabilityStatus] = useState<
    "available" | "limited" | "unavailable"
  >("available");
  const [hoursPerWeek, setHoursPerWeek] = useState("");

  const [projectTitle, setProjectTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectUrl, setProjectUrl] = useState("");
  const [projectImageUrl, setProjectImageUrl] = useState<string | null>(null);

  const [certName, setCertName] = useState("");
  const [certIssuer, setCertIssuer] = useState("");
  const [certImageUrl, setCertImageUrl] = useState<string | null>(null);

  const [expTitle, setExpTitle] = useState("");
  const [expCompany, setExpCompany] = useState("");
  const [expDescription, setExpDescription] = useState("");
  const [expStartDate, setExpStartDate] = useState("");
  const [expEndDate, setExpEndDate] = useState("");
  const [expIsCurrent, setExpIsCurrent] = useState(false);

  const applyBundle = (bundle: ProfileBundle) => {
    setData(bundle);
    setHeadline(bundle.profile.headline ?? "");
    setBio(bundle.profile.bio ?? "");
    setCountry(resolveCountryValue(bundle.profile.country));
    setCity(bundle.profile.city ?? "");
    setTimezone(bundle.profile.timezone ?? "");
    setSkills(Array.isArray(bundle.profile.skills) ? bundle.profile.skills : []);
    setHourlyRate(bundle.profile.hourlyRate ?? "");
    setCurrency(bundle.profile.currency ?? "USD");
    setAvailabilityStatus(bundle.profile.availabilityStatus);
    setHoursPerWeek(bundle.profile.hoursPerWeek?.toString() ?? "");
  };

  useEffect(() => {
    profileApi
      .getMe()
      .then(applyBundle)
      .catch(() => toast.error("Failed to load profile"))
      .finally(() => setIsLoading(false));
  }, []);

  const refreshContext = async (bundle: ProfileBundle) => {
    applyBundle(bundle);
    await router.invalidate();
  };

  const saveProfile = async () => {
    setIsSaving(true);
    try {
      const bundle = await profileApi.updateMe({
        headline,
        bio,
        country: country || null,
        city,
        timezone: timezone || null,
        skills,
        hourlyRate: hourlyRate || null,
        currency,
        availabilityStatus,
        hoursPerWeek: hoursPerWeek ? Number(hoursPerWeek) : null,
      });
      await refreshContext(bundle);
      toast.success("Profile saved");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    const { url } = await uploadToCloudinary(file, "avatars");
    const bundle = await profileApi.updateMe({ avatarUrl: url });
    await refreshContext(bundle);
    toast.success("Profile photo updated");
  };

  const uploadVideo = async (file: File) => {
    const { url } = await uploadToCloudinary(file, "videos");
    const bundle = await profileApi.updateMe({ videoIntroUrl: url });
    await refreshContext(bundle);
    toast.success("Video introduction uploaded");
  };

  const removeVideo = async () => {
    const bundle = await profileApi.updateMe({ videoIntroUrl: null });
    await refreshContext(bundle);
    toast.success("Video introduction removed");
  };

  const addProject = async () => {
    if (!projectTitle.trim()) return;
    const bundle = await profileApi.addPortfolio({
      title: projectTitle,
      description: projectDescription || null,
      projectUrl: projectUrl || null,
      imageUrl: projectImageUrl,
    });
    setProjectTitle("");
    setProjectDescription("");
    setProjectUrl("");
    setProjectImageUrl(null);
    await refreshContext(bundle);
    toast.success("Project added");
  };

  const addCertification = async () => {
    if (!certName.trim()) return;
    const bundle = await profileApi.addCertification({
      name: certName,
      issuer: certIssuer || null,
      imageUrl: certImageUrl,
    });
    setCertName("");
    setCertIssuer("");
    setCertImageUrl(null);
    await refreshContext(bundle);
    toast.success("Certification added");
  };

  const addExperience = async () => {
    if (!expTitle.trim()) return;
    const bundle = await profileApi.addExperience({
      title: expTitle,
      company: expCompany || null,
      description: expDescription || null,
      isCurrent: expIsCurrent,
      startDate: expStartDate || null,
      endDate: expIsCurrent ? null : expEndDate || null,
    });
    setExpTitle("");
    setExpCompany("");
    setExpDescription("");
    setExpStartDate("");
    setExpEndDate("");
    setExpIsCurrent(false);
    await refreshContext(bundle);
    toast.success("Experience added");
  };

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading profile...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Complete your profile</h1>
        <p className="text-sm text-muted-foreground">
          Build a professional portfolio clients can trust. You&apos;re {data.profileCompletion}%
          complete.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile photo</CardTitle>
          <CardDescription>Upload a clear photo of yourself.</CardDescription>
        </CardHeader>
        <CardContent>
          <MediaUploadField
            label="Upload photo"
            accept="image/*"
            previewUrl={data.profile.avatarUrl ?? data.user.image}
            previewVariant="avatar"
            onUpload={uploadAvatar}
          />
        </CardContent>
      </Card>

      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Professional title</FieldLabel>
              <Input
                className={inputClassName}
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="e.g. Full-stack Web Developer"
              />
            </Field>
            <Field>
              <FieldLabel>Bio</FieldLabel>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Describe your expertise, approach, and what you're great at."
                rows={5}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Country</FieldLabel>
                <SearchableCombobox
                  value={country}
                  onValueChange={setCountry}
                  options={COUNTRIES}
                  placeholder="Select country"
                  searchPlaceholder="Search countries..."
                />
              </Field>
              <Field>
                <FieldLabel>City</FieldLabel>
                <Input
                  className={inputClassName}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Kathmandu"
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Timezone</FieldLabel>
              <SearchableCombobox
                value={timezone}
                onValueChange={setTimezone}
                options={timezoneOptions}
                placeholder="Select timezone"
                searchPlaceholder="Search timezones..."
              />
            </Field>
            <Field className="overflow-visible">
              <FieldLabel>Skills</FieldLabel>
              <SkillsTagsInput
                value={skills}
                onChange={setSkills}
                suggestions={SKILL_SUGGESTIONS}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hourly rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel>Rate</FieldLabel>
              <Input
                className={inputClassName}
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="45.00"
                type="number"
                min={0}
                step="0.01"
              />
            </Field>
            <Field>
              <FieldLabel>Currency</FieldLabel>
              <SearchableCombobox
                value={currency}
                onValueChange={setCurrency}
                options={CURRENCIES}
                placeholder="Select currency"
                searchPlaceholder="Search currencies..."
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Availability</CardTitle>
          <CardDescription>Let clients know when you can take on work.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <Select
                items={[
                  { label: "Select availability", value: null },
                  ...AVAILABILITY_OPTIONS.map((option) => ({
                    label: option.label,
                    value: option.value,
                  })),
                ]}
                value={availabilityStatus}
                onValueChange={(value) => {
                  if (value) {
                    setAvailabilityStatus(value as "available" | "limited" | "unavailable");
                  }
                }}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {AVAILABILITY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Hours per week</FieldLabel>
              <Input
                className={inputClassName}
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
                placeholder="30"
                type="number"
                min={0}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Video introduction</CardTitle>
          <CardDescription>
            Record or upload a short video so clients can get to know you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MediaUploadDropzone
            label="Upload introduction video"
            accept="video/*"
            previewUrl={data.profile.videoIntroUrl}
            previewVariant="video"
            onUpload={uploadVideo}
          />
          {data.profile.videoIntroUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={removeVideo}
            >
              Remove video
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" className="h-10" disabled={isSaving} onClick={saveProfile}>
          {isSaving ? "Saving..." : "Save profile"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio projects</CardTitle>
          <CardDescription>
            Showcase your best work. Swipe through your saved projects below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ProfileItemsCarousel
            items={data.portfolio}
            emptyMessage="No portfolio projects yet. Add your first project below."
            onRemove={async (id) => {
              const bundle = await profileApi.deletePortfolio(id);
              await refreshContext(bundle);
              toast.success("Project removed");
            }}
            renderCard={(item) => (
              <PortfolioCarouselCard
                title={item.title}
                description={item.description}
                imageUrl={item.imageUrl}
                projectUrl={item.projectUrl}
              />
            )}
          />

          <Separator />

          <FieldGroup>
            <p className="text-sm font-medium">Add a project</p>
            <Field>
              <FieldLabel>Project title</FieldLabel>
              <Input
                className={inputClassName}
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <Textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                rows={3}
              />
            </Field>
            <Field>
              <FieldLabel>Project URL</FieldLabel>
              <Input
                className={inputClassName}
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
                placeholder="https://"
              />
            </Field>
            <MediaUploadField
              label="Project image"
              accept="image/*"
              previewUrl={projectImageUrl}
              previewVariant="card"
              onUpload={async (file) => {
                const { url } = await uploadToCloudinary(file, "portfolio");
                setProjectImageUrl(url);
              }}
              onRemove={() => setProjectImageUrl(null)}
            />
            <Button type="button" variant="outline" onClick={addProject}>
              Add project
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Certifications</CardTitle>
          <CardDescription>Highlight credentials that build trust with clients.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ProfileItemsCarousel
            items={data.certifications}
            emptyMessage="No certifications yet. Add one below."
            onRemove={async (id) => {
              const bundle = await profileApi.deleteCertification(id);
              await refreshContext(bundle);
              toast.success("Certification removed");
            }}
            renderCard={(item) => (
              <CertificationCarouselCard
                name={item.name}
                issuer={item.issuer}
                imageUrl={item.imageUrl}
              />
            )}
          />

          <Separator />

          <FieldGroup>
            <p className="text-sm font-medium">Add a certification</p>
            <Field>
              <FieldLabel>Certification name</FieldLabel>
              <Input
                className={inputClassName}
                value={certName}
                onChange={(e) => setCertName(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Issuer</FieldLabel>
              <Input
                className={inputClassName}
                value={certIssuer}
                onChange={(e) => setCertIssuer(e.target.value)}
              />
            </Field>
            <MediaUploadField
              label="Certificate image"
              accept="image/*"
              previewUrl={certImageUrl}
              previewVariant="card"
              onUpload={async (file) => {
                const { url } = await uploadToCloudinary(file, "certifications");
                setCertImageUrl(url);
              }}
              onRemove={() => setCertImageUrl(null)}
            />
            <Button type="button" variant="outline" onClick={addCertification}>
              Add certification
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Work experience</CardTitle>
          <CardDescription>Share your professional background with prospective clients.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ProfileItemsCarousel
            items={data.experience}
            emptyMessage="No work experience added yet."
            onRemove={async (id) => {
              const bundle = await profileApi.deleteExperience(id);
              await refreshContext(bundle);
              toast.success("Experience removed");
            }}
            renderCard={(item) => (
              <ExperienceCarouselCard
                title={item.title}
                company={item.company}
                description={item.description}
                startDate={item.startDate}
                endDate={item.endDate}
                isCurrent={item.isCurrent}
              />
            )}
          />

          <Separator />

          <FieldGroup>
            <p className="text-sm font-medium">Add experience</p>
            <Field>
              <FieldLabel>Role title</FieldLabel>
              <Input
                className={inputClassName}
                value={expTitle}
                onChange={(e) => setExpTitle(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel>Company</FieldLabel>
              <Input
                className={inputClassName}
                value={expCompany}
                onChange={(e) => setExpCompany(e.target.value)}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Start date</FieldLabel>
                <Input
                  className={inputClassName}
                  type="date"
                  value={expStartDate}
                  onChange={(e) => setExpStartDate(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel>End date</FieldLabel>
                <Input
                  className={inputClassName}
                  type="date"
                  value={expEndDate}
                  onChange={(e) => setExpEndDate(e.target.value)}
                  disabled={expIsCurrent}
                />
              </Field>
            </div>
            <Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={expIsCurrent}
                  onChange={(e) => setExpIsCurrent(e.target.checked)}
                />
                I currently work here
              </label>
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <Textarea
                value={expDescription}
                onChange={(e) => setExpDescription(e.target.value)}
                rows={3}
              />
            </Field>
            <Button type="button" variant="outline" onClick={addExperience}>
              Add experience
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </div>
  );
}
