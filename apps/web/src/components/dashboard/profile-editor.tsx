import { Button } from "@lets_work/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@lets_work/ui/components/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@lets_work/ui/components/field";
import { Input } from "@lets_work/ui/components/input";
import { Textarea } from "@lets_work/ui/components/textarea";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import { profileApi, type ProfileBundle } from "@/lib/profile-api";

import { MediaUploadField } from "./media-upload-field";

const inputClassName = "h-10";

export default function ProfileEditor() {
  const router = useRouter();
  const [data, setData] = useState<ProfileBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState("");
  const [skills, setSkills] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [videoIntroUrl, setVideoIntroUrl] = useState("");
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

  const applyBundle = (bundle: ProfileBundle) => {
    setData(bundle);
    setHeadline(bundle.profile.headline ?? "");
    setBio(bundle.profile.bio ?? "");
    setCountry(bundle.profile.country ?? "");
    setCity(bundle.profile.city ?? "");
    setTimezone(bundle.profile.timezone ?? "");
    setSkills(Array.isArray(bundle.profile.skills) ? bundle.profile.skills.join(", ") : "");
    setHourlyRate(bundle.profile.hourlyRate ?? "");
    setCurrency(bundle.profile.currency ?? "USD");
    setVideoIntroUrl(bundle.profile.videoIntroUrl ?? "");
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
        country,
        city,
        timezone,
        skills: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        hourlyRate: hourlyRate || null,
        currency,
        videoIntroUrl: videoIntroUrl || null,
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
    setVideoIntroUrl(url);
    const bundle = await profileApi.updateMe({ videoIntroUrl: url });
    await refreshContext(bundle);
    toast.success("Video introduction uploaded");
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
    });
    setExpTitle("");
    setExpCompany("");
    setExpDescription("");
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
            onUpload={uploadAvatar}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Professional title</FieldLabel>
              <Input className={inputClassName} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="e.g. Full-stack Web Developer" />
            </Field>
            <Field>
              <FieldLabel>Bio</FieldLabel>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Describe your expertise, approach, and what you're great at." rows={5} />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Country</FieldLabel>
                <Input className={inputClassName} value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Nepal" />
              </Field>
              <Field>
                <FieldLabel>City</FieldLabel>
                <Input className={inputClassName} value={city} onChange={(e) => setCity(e.target.value)} placeholder="Kathmandu" />
              </Field>
            </div>
            <Field>
              <FieldLabel>Timezone</FieldLabel>
              <Input className={inputClassName} value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="Asia/Kathmandu" />
            </Field>
            <Field>
              <FieldLabel>Skills</FieldLabel>
              <Input className={inputClassName} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Node.js, PostgreSQL" />
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
              <Input className={inputClassName} value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="45.00" />
            </Field>
            <Field>
              <FieldLabel>Currency</FieldLabel>
              <Input className={inputClassName} value={currency} onChange={(e) => setCurrency(e.target.value)} placeholder="USD" />
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
              <select
                className="h-10 w-full border border-input bg-background px-3 text-sm"
                value={availabilityStatus}
                onChange={(e) =>
                  setAvailabilityStatus(e.target.value as "available" | "limited" | "unavailable")
                }
              >
                <option value="available">Available</option>
                <option value="limited">Limited availability</option>
                <option value="unavailable">Not available</option>
              </select>
            </Field>
            <Field>
              <FieldLabel>Hours per week</FieldLabel>
              <Input className={inputClassName} value={hoursPerWeek} onChange={(e) => setHoursPerWeek(e.target.value)} placeholder="30" type="number" min={0} />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Video introduction</CardTitle>
          <CardDescription>Upload a short intro video or paste a hosted video URL.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Video URL</FieldLabel>
            <Input className={inputClassName} value={videoIntroUrl} onChange={(e) => setVideoIntroUrl(e.target.value)} placeholder="https://..." />
          </Field>
          <MediaUploadField label="Upload video" accept="video/*" onUpload={uploadVideo} />
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
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {data.portfolio.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{item.title}</p>
                  {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const bundle = await profileApi.deletePortfolio(item.id);
                    await refreshContext(bundle);
                  }}
                >
                  Remove
                </Button>
              </div>
              {item.imageUrl ? (
                <img src={item.imageUrl} alt={item.title} className="h-32 w-full max-w-xs object-cover" />
              ) : null}
            </div>
          ))}
          <FieldGroup>
            <Field>
              <FieldLabel>Project title</FieldLabel>
              <Input className={inputClassName} value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <Textarea value={projectDescription} onChange={(e) => setProjectDescription(e.target.value)} rows={3} />
            </Field>
            <Field>
              <FieldLabel>Project URL</FieldLabel>
              <Input className={inputClassName} value={projectUrl} onChange={(e) => setProjectUrl(e.target.value)} />
            </Field>
            <MediaUploadField
              label="Project image"
              accept="image/*"
              previewUrl={projectImageUrl}
              onUpload={async (file) => {
                const { url } = await uploadToCloudinary(file, "portfolio");
                setProjectImageUrl(url);
              }}
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
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {data.certifications.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 border border-border p-4">
              <div>
                <p className="font-medium">{item.name}</p>
                {item.issuer ? <p className="text-sm text-muted-foreground">{item.issuer}</p> : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const bundle = await profileApi.deleteCertification(item.id);
                  await refreshContext(bundle);
                }}
              >
                Remove
              </Button>
            </div>
          ))}
          <FieldGroup>
            <Field>
              <FieldLabel>Certification name</FieldLabel>
              <Input className={inputClassName} value={certName} onChange={(e) => setCertName(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Issuer</FieldLabel>
              <Input className={inputClassName} value={certIssuer} onChange={(e) => setCertIssuer(e.target.value)} />
            </Field>
            <MediaUploadField
              label="Certificate image"
              accept="image/*"
              previewUrl={certImageUrl}
              onUpload={async (file) => {
                const { url } = await uploadToCloudinary(file, "certifications");
                setCertImageUrl(url);
              }}
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
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {data.experience.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4 border border-border p-4">
              <div>
                <p className="font-medium">{item.title}</p>
                {item.company ? <p className="text-sm text-muted-foreground">{item.company}</p> : null}
                {item.description ? <p className="mt-2 text-sm text-muted-foreground">{item.description}</p> : null}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const bundle = await profileApi.deleteExperience(item.id);
                  await refreshContext(bundle);
                }}
              >
                Remove
              </Button>
            </div>
          ))}
          <FieldGroup>
            <Field>
              <FieldLabel>Role title</FieldLabel>
              <Input className={inputClassName} value={expTitle} onChange={(e) => setExpTitle(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Company</FieldLabel>
              <Input className={inputClassName} value={expCompany} onChange={(e) => setExpCompany(e.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Description</FieldLabel>
              <Textarea value={expDescription} onChange={(e) => setExpDescription(e.target.value)} rows={3} />
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
