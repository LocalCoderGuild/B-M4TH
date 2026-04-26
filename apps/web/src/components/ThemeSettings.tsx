import { Button, Group, SegmentedControl, Slider, Stack, Switch, Text } from "@mantine/core";
import { useEffect, useState } from "react";
import { SoundManager, type SoundSettings } from "../audio/SoundManager";
import { clamp } from "@b-m4th/shared";

export type PuzzleThemePreset = "pop" | "candy";

export interface PuzzleThemeSettings {
  preset: PuzzleThemePreset;
  intensity: number;
  dither: boolean;
  vignette: boolean;
  sound: SoundSettings;
}

const STORAGE_KEY = "b-m4th.puzzle-theme";

export function loadPuzzleThemeSettings(): PuzzleThemeSettings {
  const sound = SoundManager.load();
  const defaults: PuzzleThemeSettings = {
    preset: "pop",
    intensity: 0.55,
    dither: true,
    vignette: true,
    sound,
  };
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaults;
  try {
    const parsed = JSON.parse(raw) as Partial<PuzzleThemeSettings>;
    return {
      ...defaults,
      ...parsed,
      sound,
      intensity: clamp(parsed.intensity ?? defaults.intensity, 0, 1),
      preset: parsed.preset === "candy" ? "candy" : "pop",
    };
  } catch (err) {
    console.warn("Theme settings parse failed:", err);
    localStorage.removeItem(STORAGE_KEY);
    return defaults;
  }
}

interface ThemeSettingsProps {
  settings: PuzzleThemeSettings;
  onChange: (settings: PuzzleThemeSettings) => void;
}

export function ThemeSettings({ settings, onChange }: ThemeSettingsProps) {
  const [sound, setSound] = useState(settings.sound);

  useEffect(() => {
    setSound(settings.sound);
  }, [settings.sound]);

  const update = (patch: Partial<PuzzleThemeSettings>) => {
    const next = { ...settings, ...patch };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, sound: undefined }));
    onChange(next);
  };

  const updateSound = (patch: Partial<SoundSettings>) => {
    const nextSound = SoundManager.configure(patch);
    setSound(nextSound);
    onChange({ ...settings, sound: nextSound });
  };

  return (
    <section className="pixel-panel theme-settings" aria-label="Theme settings">
      <div className="pixel-panel-header">
        <span className="pixel-badge" aria-hidden="true" />
        <Text fw={800}>Stage Settings</Text>
      </div>

      <Stack gap="sm">
        <div>
          <Text size="xs" fw={700} className="pixel-label">Palette</Text>
          <SegmentedControl
            fullWidth
            value={settings.preset}
            onChange={(value) => update({ preset: value as PuzzleThemePreset })}
            data={[
              { value: "pop", label: "Arcade Night" },
              { value: "candy", label: "Pixel Dusk" },
            ]}
          />
        </div>

        <div>
          <Text size="xs" fw={700} className="pixel-label">Effect Intensity</Text>
          <Slider
            value={Math.round(settings.intensity * 100)}
            min={0}
            max={100}
            step={5}
            onChange={(value) => update({ intensity: value / 100 })}
            label={(value) => `${value}%`}
          />
        </div>

        <Group justify="space-between">
          <Switch
            checked={settings.dither}
            onChange={(event) => update({ dither: event.currentTarget.checked })}
            label="Dither"
          />
          <Switch
            checked={settings.vignette}
            onChange={(event) => update({ vignette: event.currentTarget.checked })}
            label="Vignette"
          />
        </Group>

        <div>
          <Group justify="space-between" mb={4}>
            <Switch
              checked={sound.enabled}
              onChange={(event) => updateSound({ enabled: event.currentTarget.checked })}
              label="Sound"
            />
            <Button size="compact-xs" variant="light" onClick={() => SoundManager.trigger("entry-correct")}>
              Test
            </Button>
          </Group>
          <Slider
            value={Math.round(sound.volume * 100)}
            min={0}
            max={100}
            step={5}
            disabled={!sound.enabled}
            onChange={(value) => updateSound({ volume: value / 100 })}
            label={(value) => `${value}%`}
          />
        </div>
      </Stack>
    </section>
  );
}
