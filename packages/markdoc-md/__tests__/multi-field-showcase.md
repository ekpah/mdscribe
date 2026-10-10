# Conditions, mappings, and calculations – Demo

Technical examples only. Numeric conditions and categorical switches have separate jobs.

## OR: ordered cases

IVSd: {% info "ivsd_demo" type="number" unit="mm" description="Septumdicke – Demo" renderUnit=true /%}

LVPWd: {% info "lvpwd_demo" type="number" unit="mm" description="Hinterwanddicke – Demo" renderUnit=true /%}

{% condition ["ivsd_demo", "lvpwd_demo"] %}
{% case gt=[11, null] %}Erster Fall: IVSd über 11 mm.{% /case %}
{% case gt=[null, 11] %}Zweiter Fall: LVPWd über 11 mm.{% /case %}
{% case default=true %}Keiner der Fälle trifft zu.{% /case %}
{% /condition %}

The separate cases are OR alternatives and the first match wins. `null` skips that aligned member.

## AND: aligned predicates

{% condition ["ivsd_demo", "lvpwd_demo"] %}
{% case gte=[8, 7] lte=[11, 13] %}Both values are inside their aligned ranges.{% /case %}
{% case default=true %}The combined range does not match.{% /case %}
{% /condition %}

Every active comparison in one case must match.

## Undeclared numeric formula input

{% calc "undeclared_result_demo" formula="[undeclared_demo] * 2" /%}

`undeclared_demo` is generated as a numeric input without an info child.

## Globally merged categorical options and partial text

{% switch "category_demo" %}
{% case "manual" value=3 %}Manual option text.{% /case %}
{% /switch %}

{% switch "category_demo" %}
{% case "ai" value=7 %}AI option text from a separate occurrence.{% /case %}
{% /switch %}

Mapped category: {% calc "category_number_demo" formula="[category_demo]" /%}

The option map is global, while each switch renders only its own matching text.

## Custom boolean mapping

{% switch "boolean_demo" type="boolean" %}
{% case "true" value=5 %}Enabled maps to the custom value 5.{% /case %}
{% case "false" %}Disabled keeps the default value 0.{% /case %}
{% /switch %}

Boolean number: {% calc "boolean_number_demo" formula="[boolean_demo]" /%}

Without explicit mappings, boolean true is 1 and false is 0. Each can be overridden independently.

## Rounded global hidden calculation

{% switch "visibility_demo" %}
{% case "show" %}{% calc "rounded_hidden_demo" formula="1/3" round=2 /%}{% /case %}
{% /switch %}

Dependent result: {% calc "rounded_dependent_demo" formula="[rounded_hidden_demo] * 100" /%}

The hidden calculation still publishes 0.33 globally, so the dependent result is 33.

## Value precedence

For a calculated key, manual input wins over a complete-replacement AI suggestion, which wins over the calculated value: manual > AI > calc.

## Nested copy

{% switch "copy_mode_demo" %}
{% case "details" %}
Outer **formatted** content.
{% condition ["copy_left_demo", "copy_right_demo"] %}
{% case gt=[1, null] %}Nested condition with {% info "copy_note_demo" description="Nested note" /%}.{% /case %}
{% case default=true %}Nested fallback.{% /case %}
{% /condition %}
{% /case %}
{% case "compact" %}Compact content.{% /case %}
{% /switch %}

Copying the outer switch preserves its nested condition, formatting, and note.
