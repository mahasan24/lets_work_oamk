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
import { Textarea } from "@lets_work/ui/components/textarea";
import { Badge } from "@lets_work/ui/components/badge";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { MediaUploadField } from "@/components/dashboard/media-upload-field";
import { SearchableCombobox } from "@/components/dashboard/searchable-combobox";
import { SkillsTagsInput } from "@/components/dashboard/skills-tags-input";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import {
  COMPANY_SIZE_OPTIONS,
  HIRER_TYPE_OPTIONS,
  JOB_CATEGORY_SUGGESTIONS,
} from "@/lib/hirer-options";
import {
  COUNTRIES,
  getTimezoneOptions,
  resolveCountryValue,
} from "@/lib/profile-options";
import { profileApi, type HirerType, type ProfileBundle } from "@/lib/profile-api";

const inputClassName = "h-10";

export default function HirerProfileEditor() {
  const router = useRouter();
  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);

  const [data, setData] = useState<ProfileBundle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingVerification, setIsSubmittingVerification] = useState(false);

  const [hirerType, setHirerType] = useState<HirerType | "">("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [timezone, setTimezone] = useState("");
  const [jobCategories, setJobCategories] = useState<string[]>([]);

  const applyBundle = (bundle: ProfileBundle) => {
    setData(bundle);
    setHirerType(bundle.profile.hirerType ?? "");
    setHeadline(bundle.profile.headline ?? "");
    setBio(bundle.profile.bio ?? "");
    setCompanyName(bundle.profile.companyName ?? "");
    setCompanyWebsite(bundle.profile.companyWebsite ?? "");
    setCompanyDescription(bundle.profile.companyDescription ?? "");
    setCompanySize(bundle.profile.companySize ?? "");
    setPhoneNumber(bundle.profile.phoneNumber ?? "");
    setCountry(resolveCountryValue(bundle.profile.country));
    setCity(bundle.profile.city ?? "");
    setTimezone(bundle.profile.timezone ?? "");
    setJobCategories(
      Array.isArray(bundle.profile.jobCategories) ? bundle.profile.jobCategories : [],
    );
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

  const identityVerification = data?.verifications.find((item) => item.type === "identity");

  const saveProfile = async () => {
    if (!hirerType) {
      toast.error("Select whether you are an individual or company");
      return;
    }

    setIsSaving(true);
    try {
      const bundle = await profileApi.updateMe({
        hirerType,
        headline,
        bio: hirerType === "individual" ? bio : null,
        companyName: hirerType === "company" ? companyName : null,
        companyWebsite: hirerType === "company" ? companyWebsite : null,
        companyDescription: hirerType === "company" ? companyDescription : null,
        companySize: hirerType === "company" ? companySize || null : null,
        phoneNumber,
        country: country || null,
        city,
        timezone: timezone || null,
        jobCategories,
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

  const submitVerification = async () => {
    setIsSubmittingVerification(true);
    try {
      const bundle = await profileApi.submitVerification();
      await refreshContext(bundle);
      toast.success("Verification submitted for review");
    } catch {
      toast.error("Failed to submit verification");
    } finally {
      setIsSubmittingVerification(false);
    }
  };

  if (isLoading || !data) {
    return <p className="text-sm text-muted-foreground">Loading profile...</p>;
  }

  const isCompany = hirerType === "company";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Complete your client profile</h1>
        <p className="text-sm text-muted-foreground">
          Tell freelancers who you are and what you hire for. You&apos;re {data.profileCompletion}%
          complete.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile photo</CardTitle>
          <CardDescription>
            {isCompany ? "Use your company logo or a professional photo." : "Upload a clear photo."}
          </CardDescription>
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

      <Card>
        <CardHeader>
          <CardTitle>Account type</CardTitle>
          <CardDescription>Are you hiring as an individual or on behalf of a company?</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            items={[
              { label: "Select account type", value: null },
              ...HIRER_TYPE_OPTIONS.map((option) => ({
                label: option.label,
                value: option.value,
              })),
            ]}
            value={hirerType || null}
            onValueChange={(value) => {
              if (value) setHirerType(value as HirerType);
            }}
          >
            <SelectTrigger className="h-10 w-full max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {HIRER_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle>{isCompany ? "Company details" : "Personal details"}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {isCompany ? (
              <>
                <Field>
                  <FieldLabel>Company name</FieldLabel>
                  <Input
                    className={inputClassName}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Inc."
                  />
                </Field>
                <Field>
                  <FieldLabel>Your title at the company</FieldLabel>
                  <Input
                    className={inputClassName}
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g. Head of Engineering"
                  />
                </Field>
                <Field>
                  <FieldLabel>Company website</FieldLabel>
                  <Input
                    className={inputClassName}
                    value={companyWebsite}
                    onChange={(e) => setCompanyWebsite(e.target.value)}
                    placeholder="https://"
                  />
                </Field>
                <Field>
                  <FieldLabel>Company size</FieldLabel>
                  <Select
                    items={[
                      { label: "Select company size", value: null },
                      ...COMPANY_SIZE_OPTIONS.map((option) => ({
                        label: option.label,
                        value: option.value,
                      })),
                    ]}
                    value={companySize || null}
                    onValueChange={(value) => {
                      if (value) setCompanySize(value);
                    }}
                  >
                    <SelectTrigger className="h-10 w-full max-w-md">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {COMPANY_SIZE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>About the company</FieldLabel>
                  <Textarea
                    value={companyDescription}
                    onChange={(e) => setCompanyDescription(e.target.value)}
                    placeholder="Describe your company, what you do, and the kind of talent you hire."
                    rows={5}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field>
                  <FieldLabel>Professional title</FieldLabel>
                  <Input
                    className={inputClassName}
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g. Startup founder"
                  />
                </Field>
                <Field>
                  <FieldLabel>About you</FieldLabel>
                  <Textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell freelancers about yourself and the projects you hire for."
                    rows={5}
                  />
                </Field>
              </>
            )}

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

            <Field>
              <FieldLabel>Phone number</FieldLabel>
              <Input
                className={inputClassName}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1 555 000 0000"
                type="tel"
              />
            </Field>

            <Field className="overflow-visible">
              <FieldLabel>Categories you hire for</FieldLabel>
              <SkillsTagsInput
                value={jobCategories}
                onChange={setJobCategories}
                suggestions={JOB_CATEGORY_SUGGESTIONS}
                placeholder="Type a category and press Enter"
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Identity verification</CardTitle>
          <CardDescription>
            Verified clients build trust with freelancers. Submit your profile for identity review.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {identityVerification ? (
            <Badge
              variant={
                identityVerification.status === "verified"
                  ? "default"
                  : identityVerification.status === "rejected"
                    ? "destructive"
                    : "secondary"
              }
            >
              {identityVerification.status === "verified"
                ? "Verified"
                : identityVerification.status === "pending"
                  ? "Pending review"
                  : identityVerification.status === "rejected"
                    ? "Rejected — resubmit after updating details"
                    : identityVerification.status}
            </Badge>
          ) : (
            <p className="text-sm text-muted-foreground">
              Complete your profile details, then submit for verification.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={
              isSubmittingVerification ||
              identityVerification?.status === "pending" ||
              identityVerification?.status === "verified"
            }
            onClick={submitVerification}
          >
            {isSubmittingVerification ? "Submitting..." : "Submit for verification"}
          </Button>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" className="h-10" disabled={isSaving} onClick={saveProfile}>
          {isSaving ? "Saving..." : "Save profile"}
        </Button>
      </div>
    </div>
  );
}
