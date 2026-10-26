import { CSSProperties, FocusEventHandler, ReactNode, useState } from "react";
import { Combobox, Input, InputBase, StyleProp, Text, useCombobox } from "@mantine/core";
import { NO_AUTOFILL } from "../lib/forms";

// description: a short line under the label in the list (e.g. what a role may do).
type TOption = { value: string; label: string; description?: string | null; disabled?: boolean };
type TOptionGroup = { group: string; items: TOption[] };

interface ISearchableSelectProps {
  data: (TOption | TOptionGroup)[];
  value?: string | null;
  onChange?: (value: string | null) => void;
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  withAsterisk?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  leftSection?: ReactNode;
  clearable?: boolean;
  disabled?: boolean;
  nothingFoundMessage?: string;
  limit?: number; // render only the first matches of a very long list (e.g. cities)
  maxDropdownHeight?: number;
  id?: string;
  w?: StyleProp<CSSProperties["width"]>; // e.g. { base: "100%", sm: 200 } for a filter
  style?: CSSProperties;
  "aria-label"?: string;
  onFocus?: FocusEventHandler;
  onBlur?: FocusEventHandler;
  onSearchChange?: (search: string) => void; // to search on the server (a list too long to load)
}

const isGroup = (item: TOption | TOptionGroup): item is TOptionGroup => "group" in item;

/**
 * Use instead of a searchable Select. The field itself is a button and the search box sits inside
 * the dropdown, so the browser never treats it as a text field: no Chrome address autofill
 * ("State", "City"...) and no saved-entry suggestions on top of the list.
 */
export default function SearchableSelect({
  data,
  value = null,
  onChange,
  placeholder,
  searchPlaceholder = "Search...",
  leftSection,
  clearable,
  disabled,
  nothingFoundMessage = "Nothing found",
  limit,
  maxDropdownHeight = 280,
  onFocus,
  onBlur,
  onSearchChange,
  ...wrapperProps
}: ISearchableSelectProps) {
  const [search, setSearch] = useState("");
  const combobox = useCombobox({
    onDropdownOpen: () => {
      combobox.focusSearchInput();
      combobox.updateSelectedOptionIndex("active");
    },
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      setSearch("");
      onSearchChange?.("");
    },
  });

  const groups = data.map((item) => (isGroup(item) ? item : { group: "", items: [item] }));
  const selected = groups.flatMap(({ items }) => items).find((option) => option.value === value);

  // Filter by label; with a limit, stop after that many matches.
  const query = search.trim().toLowerCase();
  let remaining = limit ?? Infinity;
  const matches = groups
    .map(({ group, items }) => {
      const found = items.filter(({ label }) => label.toLowerCase().includes(query)).slice(0, remaining);
      remaining -= found.length;
      return { group, items: found };
    })
    .filter(({ items }) => items.length > 0);

  const renderOptions = (items: TOption[]) =>
    items.map((option) => (
      <Combobox.Option
        key={option.value}
        value={option.value}
        active={option.value === value}
        disabled={option.disabled}
      >
        {option.label}
        {option.description && (
          <Text size="xs" c="dimmed">
            {option.description}
          </Text>
        )}
      </Combobox.Option>
    ));

  const showClear = clearable && value !== null && !disabled;

  return (
    <Combobox
      store={combobox}
      withinPortal
      disabled={disabled}
      onOptionSubmit={(next) => {
        onChange?.(next);
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target targetType="button">
        <InputBase
          {...wrapperProps}
          component="button"
          type="button"
          pointer
          disabled={disabled}
          leftSection={leftSection}
          rightSection={
            showClear ? <Combobox.ClearButton onClear={() => onChange?.(null)} /> : <Combobox.Chevron />
          }
          rightSectionPointerEvents={showClear ? "all" : "none"}
          onClick={() => combobox.toggleDropdown()}
          onFocus={onFocus}
          onBlur={onBlur}
          styles={{ input: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }}
        >
          {selected ? selected.label : <Input.Placeholder>{placeholder}</Input.Placeholder>}
        </InputBase>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Search
          value={search}
          onChange={(event) => {
            setSearch(event.currentTarget.value);
            onSearchChange?.(event.currentTarget.value);
          }}
          placeholder={searchPlaceholder}
          {...NO_AUTOFILL}
        />
        <Combobox.Options mah={maxDropdownHeight} style={{ overflowY: "auto" }}>
          {matches.length === 0 ? (
            <Combobox.Empty>{nothingFoundMessage}</Combobox.Empty>
          ) : (
            matches.map(({ group, items }) =>
              group ? (
                <Combobox.Group key={group} label={group}>
                  {renderOptions(items)}
                </Combobox.Group>
              ) : (
                renderOptions(items)
              )
            )
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
