'use client';

import { Checkbox, Table, useSelection, VisuallyHidden } from '@tounsoo/todae';

const PEOPLE = [
  { id: 1, name: 'Ada Lovelace', role: 'Analyst' },
  { id: 2, name: 'Grace Hopper', role: 'Engineer' },
  { id: 3, name: 'Alan Turing', role: 'Researcher' },
  { id: 4, name: 'Edsger Dijkstra', role: 'Engineer' },
  { id: 5, name: 'Barbara Liskov', role: 'Researcher' },
];

export default function SelectableTable() {
  const selection = useSelection({ keys: PEOPLE.map((person) => person.id), defaultValue: [2] });
  return (
    <Table.Root>
      <Table.Caption>Team</Table.Caption>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell scope="col">
            <Checkbox.Root {...selection.getSelectAllProps()}>
              <VisuallyHidden.Root>Select all rows</VisuallyHidden.Root>
            </Checkbox.Root>
          </Table.HeaderCell>
          <Table.HeaderCell scope="col">Name</Table.HeaderCell>
          <Table.HeaderCell scope="col">Role</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {PEOPLE.map((person) => (
          <Table.Row key={person.id} selected={selection.isSelected(person.id)}>
            <Table.Cell>
              <Checkbox.Root {...selection.getCheckboxProps(person.id)}>
                <VisuallyHidden.Root>{`Select ${person.name}`}</VisuallyHidden.Root>
              </Checkbox.Root>
            </Table.Cell>
            <Table.HeaderCell scope="row">{person.name}</Table.HeaderCell>
            <Table.Cell>{person.role}</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
}
