import './select-notifications.css';
import React from 'dom-chef';
import select from 'select-dom';
import onetime from 'onetime';
import delegate from 'delegate-it';
import {observe} from 'selector-observer';
import * as pageDetect from 'github-url-detection';
import {
	CheckCircleIcon,
	CheckIcon,
	DotFillIcon,
	DotIcon,
	GitMergeIcon,
	GitPullRequestDraftIcon,
	GitPullRequestIcon,
	IssueOpenedIcon,
	XCircleIcon,
} from '@primer/octicons-react';

import features from '.';

const filters = {
	'Pull requests': ':is(.octicon-git-pull-request, .octicon-git-pull-request-closed, .octicon-git-pull-request-draft, .octicon-git-merge)',
	Issues: ':is(.octicon-issue-opened, .octicon-issue-closed)',
	Open: ':is(.octicon-issue-opened, .octicon-git-pull-request)',
	Closed: ':is(.octicon-issue-closed, .octicon-git-pull-request-closed)',
	Draft: '.octicon-git-pull-request-draft',
	Merged: '.octicon-git-merge',
	Read: '.notification-read',
	Unread: '.notification-unread',
};

type Filter = keyof typeof filters;
type Category = 'Type' | 'Status' | 'Read';

function resetFilters({target}: Event): void {
	select('form#rgh-select-notifications-form')!.reset();
	for (const label of select.all('label', target as Element)) {
		label.setAttribute('aria-checked', 'false');
	}
}

function getFiltersSelector(formData: FormData, category: Category): string {
	return formData.getAll(category).map(value => filters[value as Filter]).join(',');
}

function handleSelection({target}: Event): void {
	const selectAllCheckbox = select('input[type="checkbox"].js-notifications-mark-all-prompt')!;
	// Reset the "Select all" checkbox
	if (selectAllCheckbox.checked) {
		selectAllCheckbox.click();
	}

	if (select.exists(':checked', target as Element)) {
		const formData = new FormData(select('form#rgh-select-notifications-form'));
		const types = getFiltersSelector(formData, 'Type');
		const statuses = getFiltersSelector(formData, 'Status');
		const readStatus = getFiltersSelector(formData, 'Read');

		for (const notification of select.all('.notifications-list-item')) {
			if (
				(types && !select.exists(types, notification))
				|| (statuses && !select.exists(statuses, notification))
				|| (readStatus && !notification.matches(readStatus))
			) {
				// Make excluded notifications unselectable
				select('.js-notification-bulk-action-check-item', notification)!.removeAttribute('data-check-all-item');
			}
		}

		// If at least one notification is selectable, trigger the "Select all" checkbox
		if (select.exists('.js-notification-bulk-action-check-item[data-check-all-item]')) {
			selectAllCheckbox.click();
		}
	}

	// Make all notifications selectable again
	for (const disabledNotificationCheckbox of select.all('.js-notification-bulk-action-check-item:not([data-check-all-item])')) {
		// eslint-disable-next-line unicorn/prefer-dom-node-dataset -- For consistency with the `removeAttribute()` above
		disabledNotificationCheckbox.setAttribute('data-check-all-item', '');
	}
}

function createDropdownList(category: Category, filters: Filter[]): JSX.Element {
	const icons: {[Key in Filter]: JSX.Element} = {
		'Pull requests': <GitPullRequestIcon className="color-text-secondary color-fg-muted"/>,
		Issues: <IssueOpenedIcon className="color-text-secondary color-fg-muted"/>,
		Open: <CheckCircleIcon className="color-text-success color-fg-success"/>,
		Closed: <XCircleIcon className="color-text-danger color-fg-danger"/>,
		Draft: <GitPullRequestDraftIcon className="color-text-tertiary color-fg-subtle"/>,
		Merged: <GitMergeIcon className="color-fg-done"/>,
		Read: <DotIcon className="color-text-link color-fg-accent"/>,
		Unread: <DotFillIcon className="color-text-link color-fg-accent"/>,
	};

	return (
		<div className="SelectMenu-list">
			<header className="SelectMenu-header">
				<span className="SelectMenu-title">{category}</span>
			</header>
			{filters.map(filter => (
				<label
					className="SelectMenu-item text-normal"
					role="menuitemcheckbox"
					aria-checked="false"
					tabIndex={0}
				>
					<CheckIcon className="octicon octicon-check SelectMenu-icon SelectMenu-icon--check mr-2" aria-hidden="true"/>
					<div className="SelectMenu-item-text">
						<input
							hidden
							type="checkbox"
							name={category}
							value={filter}
						/>
						{icons[filter]}
						<span className="ml-2">{filter}</span>
					</div>
				</label>
			))}
		</div>
	);
}

const createDropdown = onetime(() => (
	<details
		className="details-reset details-overlay position-relative rgh-select-notifications"
		on-toggle={resetFilters}
	>
		<summary
			className="btn btn-sm ml-3 mr-1"
			data-hotkey="S"
			aria-haspopup="menu"
			role="button"
		>
			Select by <span className="dropdown-caret ml-1"/>
		</summary>
		<details-menu
			className="SelectMenu left-0"
			aria-label="Select by"
			role="menu"
			on-details-menu-selected={handleSelection}
		>
			<div className="SelectMenu-modal">
				<form id="rgh-select-notifications-form">
					{createDropdownList('Type', ['Pull requests', 'Issues'])}
					{createDropdownList('Status', ['Open', 'Closed', 'Merged', 'Draft'])}
					{createDropdownList('Read', ['Read', 'Unread'])}
				</form>
			</div>
		</details-menu>
	</details>
));

function closeDropdown(): void {
	select('.rgh-select-notifications')?.removeAttribute('open');
}

const deinit: VoidFunction[] = [];
function init(): void {
	const selectObserver = observe('.js-notifications-mark-all-prompt:not(.rgh-select-notifications-added)', {
		add(selectAllCheckbox) {
			selectAllCheckbox.classList.add('rgh-select-notifications-added');
			selectAllCheckbox
				.closest('label')!
				.after(createDropdown());
		},
	});
	deinit.push(selectObserver.abort);

	// Close the dropdown when one of the toolbar buttons is clicked
	delegate(document, '.js-notifications-mark-selected-actions > *, .rgh-open-selected-button', 'click', closeDropdown);
}

void features.add(__filebasename, {
	shortcuts: {
		S: 'Open the "Select by" dropdown',
	},
	include: [
		pageDetect.isNotifications,
	],
	exclude: [
		() => select.exists('img[src$="notifications/inbox-zero.svg"]'), // Notifications page may be empty
	],
	init,
	deinit,
});
