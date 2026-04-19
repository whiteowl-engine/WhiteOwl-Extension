(function () {
    'use strict';
    if (window.__whiteOwlProvider)
        return;
    window.__whiteOwlProvider = true;
    const WALLET_NAME = 'WhiteOwl';
    const WALLET_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAASSpJREFUeJztvQV8VWmWL9pvns17b+bdd+/c+2Z6Wqa7q7sUKYoqisJdAwRCkBAjRIi7u7u7u7t7iHtIQgjEgEDcPTmy96q71u6paimDJJCqbtbvd34h4Zx9vr2/9a31X/6zn/0Atbe3f9bW1gbJycn8H3rvW/pxUEFBAXR3d0NdXd35DV3oyy+//L9GxkZhcXkJzpw5w8Pf/5dNWuNbeo1069Yt9vnz59DW1gIzMzP/77ovZGFlOdbe2QEra6tgYWGxigzwD5u4zrf0msjGxoadmJiA9vY28PLyWlzXwTU1Ne1v73gAQ8OjMDY+CZqa2ny80P/6Gtb7ljaZQkND2aqqKiAm6OvrA3Nz84lXugBu9D8fPXoU+AKAyKg4eDE0Ardv31l4KwF+GuTm5sYUFxdDS0sLrKyswKVLl+DRo0fbXvoCsrKyq9HR0TA+MQP6Bqbg5OwOVlbWDcgA//trXPdb2iTS0tISJiUlgampOTLAGqlvkJCQYF7qw7jJ/3ju3Dl+dXU1PHrcD4lJ6XBLUhb8/QMnCRS+5rW/pQ0S6XsFBQVWV1cXDA2NYQild2JiMujr68PTp0//4wcv4OrmUeDm7s3cq6wFVzdvSEvPQQaQJjOQ3RCifEtvhEhKKyoqAh5iqK6tgbb2+9B6vw1uSNwEIyOj1u/98JMnT/4ge/sOo6yiAb19TznxX1lVD9o6BpCfn08M8Ms3dB9vaZ00PT39i7t375LZDjFxsWBhZQXPng/Cp3s+g5s3b0JmZua17/ywf0BA47btOxevXb8F2TkF4O7hC41N98HWzgliY2N5o6OjB97gvbyldVBnZ+cZxHCgoaEBoeFhEBQSDM2tLbB95w64desW4YHvtggMjY0EKqrqk3r6xqyHpy8UFZeDvYMLeHn7g7e3f2x5eXnMG7yXt7QOysrKSpGRkeGAX2BQCDQ0NuMeOsHHu3aDtrYuhIdHwrdac/jH/+PSlctrunoGcxK3ZARt9x9A96M+MDA0hZjYRNDVNSyNj08c34J7ekuvQPHx8RPOzs5gbW0NwSFhKMnzIDUtAz7fuw+lghZIS8sCufe/8cGMjAxTIxPjJQND46Vdn+wR3m/vgqrqerCzd4bauiYwNbGc8fX1exsP+BETOepycnLYpqYmcHFxgcioGAjDE7+wuAwnTp4GSQTzsrJyoKWl8/wbH0ZwMOfm7rlqYWm98MGHO4T9A4NAnkAHR1eWGAEZYMnAwOjVPEpv6Y3S5OTkx+7u7gTYITg4GGLjEiAjM5tjABnceBMTMygqKsH/L2SQWf63rz9Iv6CYEGZl5wsdndwWduzcJXzQ1Y0M8BC8fQLY0LAokFdQWnFxc89cXFz8ly28x7f0PYRSPMLMzAwiIyPB0dERIiJjobG1HYbHpwBVOxTi5k/PzMG9e/egv7//TxZdV1fXpz6+/vCwu5dNT89ZFr0sxvr6BUB+QQmER8TAeRHReStr20UbW/va6Ji40i28x7f0PZSXl8eGhoZCSUkJvPPOO2BsYgGtHV0wObsAHp7euL+P0ayvAZISyCSWX3+wpKzMOi4+EfLyi9cam9r4iAMQ+ftCfUMLpGfkwOUr14a9ffxWUUpMm5iaT2/hPb6l7yFDQ0Pw8fEhWx9+9atfsZpaelB6rxqm55fAzz8QklPSoOJeFaoCE0CgWPf1B6NjYx7V1NaTvb8cFhHtFR4RBYgHoLmlHTofPAJ7R9cp/4CgJT+/gGf4M7O7p1tuC+/zLX0LtbW1XT969CiTkJAASkpKcODAART7RpCWlQtPng+Dq5sHoPTGA51F/8f6+vrOff1hJxen4camFrCwsmUcHN1S0H5kSGRkZObC6poQCBvY2TmO2drZVzm7uiX7+vkmbuG9vqVvocTExCExMTHGzs4O5OXlwcPDg8NuZZU18GJ0AiSlZCA0LALocO/duxfc3NyEX39Yz0B/pa6+EcVEMKOsrFmLmy8gCUAxAYHwS0hLz2ZU1NS7jIxMGxAL9AUEBfmNjIx8soX3+5b+jF68ePGOlpYWX19fnyUPIEX+ioqK4OmzIcjOL4KRiWmIT0jipAAxwMGDB1kDAwP4+gKo15dJNOAbGAQORUp31VY0NHVZbR2Dub7+J+zjnj6hlrZei7mlZbKWjlZrRXXFeSsrq7ItvOe39GeE4nx627Zta/v37xecPHlacPjwUaGamgbnx0lISYfF1TVQUlVhnFyc/8gAh44IvL29/8QA5hZWqyGh4eQyZJ1cPCNVVDT77iqr89U1dGZa29pZgZAFuTsK3Vo6us36BgaF2dnZav7+/uFbeM9v6c/oi/37lrbt2L703gfv82Vv3+F/vncf6+ziBm6efhwGWObx4fyli0vunh4cEDx+4tSyp6fnnxjAy8evJTEphSQAGx2baGlmblOspa3PMzO3nkergFnjCZjw8MgJaZnbXUbGJkM6+nq1ZWVlomhPhm7hfb+ln3EOvKgz584unDx9aklbR4//ye7PGLTWWErjE78hBU1tHTA+PQMnzpweDY+MgJzcfMB9FAQEBLBfX8TO3nHUx9eftbCyBldXzygfvyAXwgOGxmYz+QUlTFl51UpZeeWKtY1d911l1Rd2Dk73XV1do9DeVOrv79+1hff/d01TU1M/19bWfkibf1X8+oqUtCz/wkVRJik5FRISU+HSlevM+PQc4oACRlNXp8vZ1QUys3JYZVU1fmBg4J/c+ogOB5VV1FY9vXyQAbwiIiNjHE3NrISKSmo8ZxePqYLCUv7s3BJTXFKxpK6h1YNiZBV1SJmDg0N1cnKy/RY+g79rQhxWjCbfkPhNCcGBI0eX7yjdFaLIZ+8oqbDiNyVZD+8AYVFZJXvhitiMoYlxY0lZ6Up2Th578tSZ0aCgoNWvLxQRGdN8+sz5JV+/gDVrG4cHcQkpdU4u7o/NLWynNTR0m7JzCnhz88tMb99TvpOz+xSKmrGoqKhlXEBaR0dHIXHiFj6Hv0taWFj4b6jHfY4ePyY4de78mtRtOb6uoQmroKzGuX8/339IGB2XLEQQKDx8/MQwSoDux709vOiYONbKxi7YxsZm7OuLFReX2p44eXoCTb+5lNTMwebm9gl3d58ERyf3UTV17XQ//5Cl5y9GV3l8lgkOiZgzMjHrSUlJWUHTI1NOTm6mrq7O4G3RyJsld3f33Bs3bqyZmpsJbysortk7uzBk8lnbOzFtnQ9BSUVTUFBcwRiZWa5cunKlXltPd7b/yQDj4uq+gio/Eg9v59cXQ5v+VzraBlO3ZRWe1de3LOflFg15e/nXBPqHVllYWDfp6RqVpqdnLc/NL/ImJqeFPn7+i3r6JiNoZqxIS8v19fT0P09LT0/bwufxd0XBIcHZkVGxxSqqWmiqGwqt7ZwZewdXMDayEM5ML4LSXXUmJT1XoKqmIbxwSXRQQVG5Ud/AqDMmJoYJDg5+kp6ePtvU1HTs6wtSNDA5KX1J8pZsXW1NkzA/t1A/PDSqLTwsuj42JnHCxNgyvryikpeTkzezvLLGlldUoyhJ5JGjITwiet7C0lpYXFryNDs31/J71v2WNoGePu09aGllmUzBusCgMDY3rxgcXNzJWQdNjW2sv18w7D9whMkvLmMMjUxWULK329jZPysoKs40MzPjofX2LDY2lrKC/vEvLhwWFvHi0oUrTQH+ISOI7m9mZWX7hYaGT/v5BbQGBASVW1jajpWU3ludX1gRzswusgGBYYKo6HgB/ptyBnhp6ZnkZJh49uzZP37H2t/SBonUrL6+fjOlelFwp7SsEhCsQ2paFpe9hZYbfLZnH+Pl7S+QkpbjXRIVm5WUku5QU9ecrW9oWjIwMJjV0dGpNjY2HvnGxW1s7DPFrlxv1NTQzc3PLzQuK7snEh+flBkcHFpZVlYxYm5pm5+ckr6MgHAWASHb2vaAedjdC2glMK1tnayCogrT0/sEUlNT67fg2fxdED5bbw8PL5bc9ItLK2Bja4/iXoWL2lLuhraOASt+TUIYF58svHzl2srxE6dGXF09JjU0tRtIdSNme56RkXHbz88v4hsXHx0d/bW3t3+gtZW9X1NTS1d+fr7EvXv3RBISErzCwyMfh4RFejk4umTn5Zestd3vWh2fmMGFeAspfZw2nopI9PSNob6+iYcA8ZspR29pQxQfH5+FtvtI+H+meJHElb19BxqaGqGl9T6guIczIhcYb/8ABk115syZc/No7g2rqKpP1dbVj3Z0dgGa7qa6urpN3xD/RJQU6uzs6m5v7+zU1tY+l5ub61taWno+MzNTOT4+MT0uPqkvJCRCz9PLf6qgsGxtaHhc+LhngPX2CWDy8othdm4ZkDGgv/8JFZHMDg0N7diC5/Q3SZOTk/+E+ruZyr1WVwTwx6IdD2hqaQYhywBuOMjKK4CblzeTnJ4BH3/6mfDyZbF5/PuUiop69cjoONPQ2Mzg6ZdG64H9zi9ycXGLRL2vn52dl4U4oKmiokIMOU+zvr5eFEHGtK9fcKK5hW0jSoHVwqIyAoGsh6cfQ7UD9yrrYH5hFcib2N7eTqpgHpnq/3yDz+lvkkjvh4aGluXl5QGCcOjrGwA01cmdy/VtGHj6hMv2OXj0GKRlZbOnzp1n0SwUHDx4eD40LEIYHBK2ODY+iZJ6gImOjlbX1tZe/s4vc3R0fEInPjIy0gTFeGNUVFReeXn5ZVQHUllZOaaIBea9vX1tHBwcH+CpX8ETL3jY3cdaWTuwZeXVUFPbCGNTs6BjYAgd3d1MSGj4d3/ZW3opcnJyak9LS1skoDc1PQ9lFeVgYGQI1LiDcv719A3h8NEjlMDDXhETJ2ZgTEytBMYmFquqqur8/MICXmFxkcDe0WEFAWSrp6dn8Hd+Ger7EPzCWBThusgIVikpSTloNpzBBdxFKXAa7cg8f//AfCcnlwAbW8exinu1vJHRKSYhMY2xsXViySwcHB6Dzu4eaO3ohJLScn5dXePVN/i8/qZoaWnpfxibmkyGhIXC6NgU5OQWgp2DPUzPzsDy6grclpPn6jYp8ldWfo9L/c7NK8ADaSu0s3fmi129tuDg5DiNTLNy85bECxUVleEfrO+0srIaw82XQnFh4+PjlRAWFuKalpasHR4ebh8cHGyD2OCph4dHvZ2dg29IaNRSTW2TYHBwnKmqbmA1NPXYgcEh6H0ySIkIbFJyOqAUWMrMyql/6yl8Naqtrb1laWmTHhAYzDXooM0vK6+CVd4ajE9OgLmVBcX1wdzCigI8cPTYCcRgHRAXn8ju/PgTFplDgJvPO3PubI+uvt6EuqYGz8vLK/IHv7ihoeEi6v7TISEhzsHBQZ729jYFbm4umfhhf3t7+zRLS0vf5ubmcScn12I9A5P+uPiUteTk7NWh4Qk2PiGVHBDQ8fAxLK0JuIwiqi3w8vZdKSsrd3sDz+1vgvr7+7/Q0tJpTUhM5qQqmXlfFelMTE1CYnISWNvacOLf3cMLvth3gLMEKOVrx85d9DsrKSXDV1VXW5GSkX6uZ6A/oqCkyLx0eX9hYaGHj49PHJ56S2tr6z40HcZtbe1HTE3NK2xs7PK1tXXLcvJy5g2MzAo1tPQ6Kirq+WlpeavT08usq4cvEx2XzFJAgmG/BC1tfQGZiDExcQudnZ3HX/Oz+8nT7Ozsf7GxsysrLavgwJ6nTyBk5xVz/55fWAGK6Zuam8G1G9fBxdWdy/efnllASRsJv//De0A4wNTMgr16TZyRuS3L09LRXkxOTVmRlJF6+bI+PO0P0WYsRJHvrK6uOaSkpDyto6M3aWNtP6WpoVtnZWVdom9o2Ojg6DqiqaVfYmfnNtvc/ECQl1e29vDxAEu+6b4nL7isYtJdCEiEjx/3kmUwNTo6+sNNCv5OidQk4qzM5pY2LnNnZHQSUjNywdbBFZaWeVyOH5V8X7kqBpTd4+jkwnkEs7Lz4T9+83u4fOUq5w+4KSEJZ8+fYxXvKvF09HT5JWWlwpCwMOuXXgiCQGMbG5scY2OTIV1d/blr125MS0hIzqqpaU44ODiNmplZtKioq9b4BwRNW1rZjN2SluvATV/MLy5fRfEvxNNPUoCZnFkEHp+F++2dVGgiwJtaTk3PmH2Nz/AnTSgls1JSUjujo2MR8c9yrt64+GSg7N621gfQ0f4QRM6LQmhIJERFxUBISBgUF5fCBx98BKdOneEqgqkfkIiICOzatYsSRHlo2bHXr19nX7nB1927d4d8ff2t0JQYUlFRmz958vTCoUNH5tXUNOZRDcyZW5j3yisqtF2/ITGAZkefqPj1ZkNji4WSiire+NQ8k5aZx4RGxPInp+ZhaHgcJianCaEyPb39bF5B/sBbUPiXhLZ+ailaTbSps7PzXD0G9WiouFcDj3sGoLOjG+Tv3AVzM2uICI8BZWVVuHevCvbs2QvUD0BHR4fbeAUFBa4mAME86OnpMVQGhgda4ZUX5O7u3mZkZJqHJp8QXwJNTW2hmJj40pEjx+aQKRbQEhjXMzC4r62t15hfULSgZ2TaL3ZDciAmPmXxUe9TQWPLA2FhSRWvo/MRMzE5By+GxsDTy2extq6BSUlLqc3IzGx7Dc/xJ0m4+d7kp09OToWJiSno7n7MnX5vnwC0AKbhQVcP5OUWgbSUHFRX1QMeRHj48BEcP36SO/mmpqZw4cIFrgPI/v37OWYwNjZG3BWzvtNP1NraegAvwpw5c2bt9OnT825ubiziAgYXunr27Nlp5LpZPz+/cUND4/uKd5UrEXiMIdofuSUpO+Hm7jPX0dEjTEjIXERGQGboEHZ09bCTU3OUn75KlkFlVc1MUVGR+2t4nj8pam/vOoJqlSUv3zRKy77epxAcFA7qGjrQ1NwOxSX3uJ/RUfHQ83gARfxlaGtrhyuo769duwa+vr6c2JeUlAQ5OTmuKOSXv/wlfPbZZxAUFAQODg7re8ZkMpiZmbFXr14FOzs7AW78Cm76E39/fwZ/ziDHjSNInEfAOGRiYlJzV/luKYKNhYuXxCiLaKK+oZVfXFy1GhWbsoQolk9M0P2oT0hM4OTsOksNKGNj4x/U1NRJbfIz/ckQpdKJiFxczczMhoKCIhgbnYLamkbQ1TGEwqJyIPVpZ+8Cz1+MQRlaBZ6e3lBVVYPi3QZ+97vfAeI0EBcXB+oIQmKf9gp1P7fxYWFhkJaWBpOTk/+27gVmZmYyR48eZanMqLi4WNTJyQmvmSZJ6URWFlajEhISg8gks/j/g6bm5gXWtrZxKanp85paOlNUT9iDqsDKxumpg7PHRFHZvTU0BxnUbVR6LkD7dfjFi2GoqKjszsjIbN7E5/qToOzsbIeDBw9CXl4BDA6+gKXFNairbQIXZw94iCK/HXU+9WjqftQP5eV1cOzYCdzga1yDB+oAdv78ee60k/53dXUFW1tboO5gt2/f5hiB/kZFohtaJJ7uVbpgSkrK1ynEqG9y0Z7/JDU52eTGjRsDampqL1AVzBFmQPu01N3TPTQ8ImpRW8egIj4hZbr/6RDfyt5xKCgscjYjM28VGYChUHJ1TR3f0dH52cDAU0hPz+x7+PDhzg0/1Z8IUSu3Q4cOsKijub49BPpaWzrA2ckd6uuaobmpHQJRDVC2T0pKDvT2PgcE4oD4C0+9HVy8eBFBoDL3om5gUlJSQJXBpAYI/R8+fJilBhE+Pj7fHfl7GYqKihrS1tYGtAiefPU3FFv/bGRklIsixi4kJCQTuW4AscJTe3v7IXy/QUZGxhUTU/NnRsZmz11c3dOm5hbZnoFnfGSAscLCKh7hgp7eJ4LZuQU2Kjp2zsLKuo8wAVoGD/r7+//m6w3J+tHT0X1MG0Si3MPdBzf8PiQlZ0D/sxdcez5K76IQe3llHTx9MQXR8RlgYGDEAb6AgADulJPJ98EH7yEWEIV9+/ZxeICysWZmZn6FlkB7dHT0UlJS0sYYIC8vj09FhGJiYmN//X946p1KS0uvoER4jIspwp/D9fX1N3Nzcy+jCiihamJnF7cnsYkp8wODQ4JVAcsgLhCGhEYtl5VXLVFGi39AyLOCwlLG3NI2u6evFxKSkh6Mjo7+9w0t+kdOiJ0EtIE6OnrcqfbxDuASabJzCoEac5HJHJOQDMVlVZCJf0vLLICdn3wBH364DU++KKL/h/g5FThxglTCFTh8+CBt/syfh97xcOp5enp2xMXFbUwF0OABiu2fPHly8tv+39LSsjg2NlYPmSE+ISHhNn5xQ01NzREvL+94X1//jKDg0CnfwJDKorLKmUd9TwTNLe38wcFhIer/p4GBwUNPnr5gHJ3cJ4pLKoTm5lZp4xNTbGJSympDQ+PfZNygqqpKSU/PAEG1Ax4qcTA1sYIbN6WgsakNxX0RdWiB2Lgk8AsMg6TULOh7NgKG+J5tOz/l3v/gwUPo6Ojg2r/s3LkTjh49jFLhBPy1mYdA3Ya6gFCnsHUv9sWLF/9O9uXQ0BA5GB5/23tInCEwTEcJEKOkpJSHpuI0IlBXMwurzqiY2GAjY9NJb/+gGt+g4IiMnILp0LCoOUoqHRkd5/f09q/5+QdXVFXXP0lLz+Hfb+8Suri5N1H8gFKeWlpaVqhz6bpv4EdGuCkNBOCIASIjo0HsynXK3uUCPLs+2cN1ZafmzlfFb3Lu3/7BUcgtqoAjx8+ApOwdMDIygfv3OwBVLWfrE9BTULizjHvwT3/9XSSZqVUMAcN1O9xQ/Ntfv34dAUgvdZxY/a73EfehmqiRlpbu9/b21kFgM5GRmT1Z39g05+jk2hEaGT1v7+yWauvgEp+ckrmMYn+KhS+p4pgdePKMl5mZW44SoN/Ny5eHWIEqlGeptq2opJh0GvW7CVvXDfyICO/jN2fPnuc8dwh4ITIiFk6eOocYwA7Ert6A8Og4ropXQkISFJVUobbhPqTnFEFAaDT8/r1tYG3jAK2t96G0tByB4BHOCsCDB8PD/d/aureysvJyTk5OEGI1+ItuYK9CCDaE5F0inUO9Z7/vvQj+dNEiWEWJ4Y5otMbH11/Y3NK2lpOTp2VqaSNUVteasXN2CbWzcxtFZMt/8nRQMDo+xghZhqXEBipBr65rZsqrallKKEGACCgIYGllGbn+PnW5ZvHnTzKxpLm5WYVmL9Cpr6ys5jx5YldvgqeXPxw8dBzsHN1Ax8AYlFQ14OOPPwEVZQ2orGsBG2dvuC6tCOcuXOG6e+TnF+KJV+JOP1kPDg4O39mlRV9fv52wG5qaUeteeHx8PIvgj9M5aF58L5qkhFIPD++nUVExFp6e3hTHFiCyZxsbW08hyl81NDKe8A8MNkXT8FF2Tt4ynnB+XX2jcPD5ELO6xmeFDJDrk83KzmcbGlthfmEJN30QlpdX4XFPHxdHIEuhoaHBed03tAXU1tZ2+YsvvuA2vr29E+bnF4EkAXVeS0xK49rwUxdW8vmT7v9k9+egrKIJMYmpYGRuC+cuicMtGTkQvSwO5CxydXVHdXwRVFVVYW5u7v/7ru91dnYORLXMnjp1anjdi0fbkiHTgnSOlpbW90oA8homJCQJPDy8Fvz8A5dq6xogv6CIra2tPYsm4byTs+uKg5OLrYGhUV9EZPScrq7+tNwdhfmY2HiOUVDns5TtQj2JJiZnAVUDF+WampqBuvpm6OjshvKKSk4dISjtXfdNvWG6efMmU1ZWxpl7i4hr4uMTOSBXWVXHgT/y91MeZVR0PAQEhsL2HZ+Aspo2hITHgKKqNpw6fxk+3LGLK/wg8f9V8If6AM7Pz//X7/vutLQ0mQ2N+PHw8EhOTEzkokqnT58WfN97g4JCwnx8/BjyauHGC1HEky7ne3h4enn7+C3l5RcK5OSVygMCg5cQ5fOCQ8LWwiOi1mxs7QX4YiwsrVk6BSurAigsKqNrcBJgbY0PazwGgoLDuQ5XtBZigoGBgdUf8/QS0ruoo8fJE/fHzVoENzcPqMODQdLAzNwart+QhB07d4OGpi538t//YDtcEbsO+sZmaPrlwdmLV+C0iCi8++F2LpBGsQJiAm9vX9oPQDOv5LXfCCJXPeTi8omJiX/9vvcFBAQtnTsnstDY2AxV1bXM/fZOBtUAaGho56ZnZAmMTczmNLV0xq/fkOgNDY1Y7Xr4iKWwcEFhMUspTZTK5ODoynUmH3jynGtuTCKTJADNLSKmCMP39Pb2AyWWLCwsQH19/Y+2XyGaww+/CsmOjo5CXFwCdHV1w/gfh2/Bvv2H4dPPvoA/vPshHD12CrZt30UlXbD3i/1w7vwluP+gGy6IisNteWVOKvT1PwN8xpxKvHNHgZpAstHR0S83AuZ1E7Uej4iIWggPj2T9/QOZwKAQ/vMXwwh0rq3dlJCcxdMvPHDw8ISMrNxMVU014+XjzdIQA5pgcfzkCdi1+xP43e/f4XLZqNIlJTUd5uaXobTkHnh6+HJesuysfHj2dAhmZxa5TJlclDSdKErV1NTmt/r+/5oKCgoMCIDR5tPELlwjZGXlQA9iGYrhkw6nBs5Xxa/DseMn4Tz+fuGiKNfLl1QuPYtTp89ylsFdVS3Q1TOGa+ISnO8gNjaegCBDcwFJReOz/3+2+n5/1t3d/fG1azdWdHT0lqytbZcCAoKX8UTzNDS1p3R09Vc/27N37bLY1VlEsgt5BfkspTLtO7AfxMSvQn5hASt65TLoGeizv/ntOwiA1CiLmMMCTwaeQ0V5NYSFRkFRYRlVvkJ8QgpXhkbdS7sf9XAPeavv/8/p0aNHey9dusSam5sDOdGoYWNWVhaC1ya4dUuK69YdHBzK5fERLqC6vt6+AY7xUUISaudy/ai1O5rFcOK0CHQ97AUpydtcEIjcwefOXRDo6emtoYlXn5CQIP9t60DV8zG+5+WnhG2EbGzsKENo1tTUfBG5cwm59/mHH21fopYzqP+FuPErBobGayjWGSplUlBS5KZXfPb5HlDTUAc5+TvEAAy1qNv1yadwR14RH4gCFxadn1uGexU1UFPdwGXB0OSS6JgELjeOwGF5eTmgmWX2Rm70B4gcLoi6ueFMjY2NnO6PiIggvMIhf1VVdU6NdaA1Q42a9h84BKQmESCjJRCPtr4dl8hBQZ1/+/kvYPfn+yAgOAIGn49yhyEUD8bRo8fZkydP8zU0tISamprTCNAXvs3Rg/jjv6AUev3jfSgwFIPgTFfHcEFDXWfh7l2V1c+/2Dt77vyFFZELl3hXxMRX1TV0+GTa3W/vYkUvi3FZqzdu3uIaF3/w4TYSgeyez78QlpSUoWiTEn6y+zMQuXAZ3D18uE0eHpnEzz5ES+ARZGUXgJ6+CTfGhjJkF9BcxNP2rW7qN03p6amW5DgjkU/NmqlhI5nQFK2jsC0BarKoyIFDblwK5qCpzSV0VFRUcL+TCrCxs4WLly4DHYbklAxo6+iG+SUetN/vAgtzG+bMKZFVRcW7q76+/gK0vAZ/yBp4rdRQ23Cx8l4tuLt5C1FMLauraw58+OH2STrtDo7OAgR9y4jeGUT/bD2KQdJ3lLl68tQZboQJ3ihtPh9B4jjqxkVnZ1c+Mgmz+9M9nKeMUqGbmu9zwJAGWNDpJ/HvHxACLa0dsLS0AvgQ1u/t2iTq6uraIS8vx1BKFvXqlZCQABrciKeUc6LRptPpJguGpAT5Bo4fP86FdYk5yLtHSR0fffQR3LwlAYpKyuy//tu/g6qaFji6eHIMQDmBLc3tcOXytUV8zqtoEQjMza2Ympoa8S27cRogEROdwE9KTGMkbsmsiF29cd/a3mk1NCKWVVBUnUFUz796TXwhNz+HlZaVYvX0DNjTp8+yN25IoC4TWQwJCXM+ePDw6qlTZxbxQXUYGxtXGhmb8pBBmP/+P/4VPtr2MSf2abOpLo7QMNnO5EQh0/A/U8soPWrLBlnk5+fIX7t2FTdTBKKioigREwFfD5D9T1E/OuWUqkXMQBtOp//s2bNcIsf27dtZd3f36P37969cuHCB2bdvH3P95g32kugVBkEhi+Yh6+7lz1JgiFLE8UCwaC0J0XRea21rBysb20RUnd1bde8/C/APYeJikwRVqKMV76pOqqhpNji7ebP2Tu5w6fL1QTt7Z8G+g/un9fV1BXeV5WmcKaFXAjE0sOAjugZ5EVFcVnl7e7sjsOmUkLz1BAEkDyWD4P0PPmLJVqYSMyouoQIIqjPw9QvipplSyjS+B21p7S0Dgyoqd1d37doJ+JPUEaf3KYLq4OBAg5u5k02/S0tLowl3h1SCADeah5vPe/z48bt0jSdPnrwrLi4+jJKAh/fPIAOsoOXEz8zKY+WV1Nig0CiWLKOa2kbWysqOGnkLCDwmJqXExMUnbl0Bbn5eMUNJi5lZ+cLsnMIRT08fp5T0HPJmCfSNzeZDQiMZ5PaV48ePrpiZmbCmpqbM5cuXF2/cuLHy19dKSUkxdXZ2DnNwdqx1dnWpRDHIIKDkv/f+hyxhBhp+NDk18/WrpLSceuSAtMwdsLN3BFm5O2/cQxgTE5Py/vvvgomJEaSmJkNOTg6H5EmsU0oWmYP0k5JqiBEQI8yhNODj6a/962vhc3lkYmISL6+owFNUulu2c9fusZjYRKGo2A1+ZEwiU9/QwjGBjKz8SnxCEvlahPdqas40NbdunSXk6eXHlpZVoekWxaPMVTVN3YgoPJXqmvpjVrYOPGpZ+vnnny+gblw7efI4ize+JiIi8hSB0jceABGaTIbpmenOxqYmFVLSt+vVNbTYs+dE+MEhYQwNsaCuGDTIeml5FUXiOIRFxQINRaBpJ8gwuAnpDm/q3hEA/zuKeEZbWxN1vANusBQH+kgC0EAG+knMQJtPrnRK2iA1h/fe/201egEBAbZo3w9Jy8qMmllY+Rw5enzOxdWTv/OTz1dtHVxZFP8MVQfpG5iMh0dEsXgAmLy8/DDyqL6pe/4LIlcsmXp5+YUkohdxw+NExa73evsHCW7JyD+0c3QTmpiaC3bv3jWlrq7KeHt6sSgCxxQVFRe6u7u/s70smlBX/f39g3R1dXOpOOWOgvzyvgP7hXJ3FISaugaQkZPPpU7NLq5wTEBOJ6qRk7ktyyHqNwWKEK8IKR2bxD7Z+9SenTYeTzKoq6tDbW0tJwEoP+/KlStTCAJHm5qavnNtVLadk5OvhKDW2sXNw9HZxW3Mw9NXePWGJE9NS1dIamB2YZVcx2NUCo7iX1hWUT6GGKNsS6a604L19A351TV1QE2irOwdfM6IXJp1cvNkrkvI3I+ITmDx/1d27tw+bmCgx9TX1tFJGEI7ee6HTBeUBKooRsdQZZSpqquNGRgZ8j/7fI/w4iUx1tbRhUuYmJpb5AYgUUk0OYXiExO4cemUwIJYQ/t13vujR49EqQqHTjad8IyMDGhtbQVUbTSIgQOBhOyRQRgEftM0rRPXduP7rkn2PPUDuCp+/bm9gxNZTtNa2npLqEqFalo6KzHxKWz/0yGSeKPjE1NUBs40NjetVVdX531fZPC1EYq7XYhGWS9vX35zSzurZ2SaJnZdYg0XzNy4JfsQ9Rb5+AVHjx5+LiFxg9fW0kon46Gfn1/Qy2Sp1NXVXUUmGEaA+ExM/Oqc4l0lAZqR/NPnL7JZeYVcCfrKKo+bgUMMQEWTFHcndE0mGNrifa/jvsnkDAwMXCKTj8Ky1HOPzDvKvqFpHQT+yMQju15SUnIcpVlZUFCQ38tcG0Hhbilp2cdoQgvJlEZ9v2jj4MxcvXFrOjktm+l61M+amFouPBt8QU4kQd9AP+X+F3+fRH1thGbO1YjIaNbcwoqPZpkAzb++65LSkyimVyWk5CZwwYgPKlhR0YsvZGWlBZUV90hc5qOYfOkOYg0NDddcXFxyzczMxsXEqOedDH/7jo/5NM00JSObY4Cg4FBOBdCcXCqUoNNAOhb1c2tlZSUFjnhjY2O/2az7RlNvnMw4ctpQvkRnZydn45PJV1VVxeXro6oTICNOIoNMowVw5GXDsgkJiSGm5hZpZuaWfAqUySsoD/gEBPPPnL/0DE1rXu/Ac/KDCIuKS4GKbWvr68jx1EZ7sVn399JUWFgiToMJUQrwEO0vu3v7PUUGGNDQ0efJySvPlt2r5ZoWoI08raamIiQGQL2Z7enpyXuV70G9KYoPeBnRdK+KqjpP9LKYEIEhSz3yqqprObcqRdEQPHG1cQTOvvosit8Fcs1S9HBkZITt6+vT2+h9k74nk47EPaV204mn39PT0zlGoAHNhoaG42jRVBUWFkq+Skw+LCxyICYuwdTUzGIVN3hMTV27ycs3YE306vV+T59AHnkF0fLh09SPkNBwNiomWighITGRnJxssNH7emXKzMyRoqiWhaX1mq2d01Riasa8lp5hKamAW9JyEw+6+4BEla6utiA6OpItKiikBxMfHR39vbkF30apqanyUlJSS3T65OTvCA4fPcIoq6oIKahCCaT0QI4eP8aJY3zwf1F02tzcfJxENTliUF/SRq37YSHgaqFriYqKAqoy6nfAAT76SRgAGYBFJpxC+3+Z8vJe9foZGVkztbWN5/B++PYOjtXKKhr3DUzMhfJ3Vevcvfz4IeExjKqqViuaxPyY2Hg2LCJ8DdXk48jISK/13tO6CXXsZStrW1BT15i3tXcaQr28FhwW5YE6Cy5evjZJ4qqv/wk+eHVebGw0W1NVTS7SVjzJr+y4oFOEVkEyqoM1lCJrSsp3hR9t38aQK5n8ARRUkZSW4nSygoIC89f1cLj5uVQ188UXXzAEtNZzv6RaSMdT+RV59EpLSzn0T0kf9fX1nIsXxf/0f5p6uevJaC4pKVvJzS1QyMrOZam5s76+cZmxuRUygFqVj3+IMDAkklHX1EkgLyBKX9be0WFET0+vOikpyXE997QhGhwc/K2ahs6wopIqLygovDwwKHS1t/fpTjd3H1bs6s1uCt48GxymadXDo2iukY2MDyYbT+iL9X4nbvBDqlJGs4rBjWB+/etfC1EXsw8ePOA2hJA5boIQRSK7mfEBAq0Itvjk1iXTj8xNGs5MefeIU6hugkxAFtVBBUqEKfJurud7EhMT1/wD/b1z8nIJW71AlfeQJMClK9cfZWQXCYPDooUuLm62CQkJjI+Pj9DR3mFeXOzqk/z8/G8NC79WomQEdQ2dsps3pRZdXD1HEhJT2cDgMA9NLX2BpJTcg7r6Fi6xQ1z8+vgMmmtkF1tZWUXiBs6tN1edABV50miDKSkCTyKLp5KhCVgEwMgTl5ubS0EZIf7be7PuFZlLmaJ8pOcp0ENmH1kciPA5xI+SgJxcz3BNVDL/3X34foAQHy0HBQd5JqUks1FRMUI1Da1hVKsrF0TFe0rKqxlUAcLg0AhTZLYVYnoPN3dG9OKlfjxcezbrXl+ayPlgbmGboq9v0uzg6DpPNW0+vkEP7ypr8OQVVPqj0QwcHpkAeXnFeUqHoiiZu7u7N54i4fj4+P+/3u+Ni4szdnJyYqg6BpmB/eijj8jdzKLI5cw/2hjclNWAgIBNS5lC7MGnNq2HDx+G8PBwrvw6JCSEE/0U1yBwa2pqGoVWTvp6v4MOBUqVLm9/3zBXdzcBteA3MDR+gipgVfym9MPMnELygQj9A4MdEUvNI8OzKSkprI2VbTp+9v/erHt9JTIzs2xH5GqYmp49Xl5RvYDm4EpYZNyal2/QsrmVPfkHgFLCELHzLaysBAiMTuKiW9FsefmGRd9CqOfXEIUL8LRzFbK7d+9m8eExaO5xpiBuDot/W1tcXNxwnSE1Vkbgynn5fvvb33IMsGPHDiCGoFi/lpZWK+KTchkZmdGNfM/Tp093FBQUSEvJSD+zd7Bv9vHxM7O1c+CbWFgLNLQNZmiO4+kzIit6Bvp9KCF4FhYWY5GR0SP29g4zG73HdVNqetpkRka2QnZunsDXN6gYGYCJiE4Q4otRUddZbGi5T+5aVl1dcyo6NoZFKaCD4vQ2ouQNhW8Rf3yAup+6klOsgUwylubhEhqnFCzcGPxOdSGK6uKN3iNuiiud9EOHDnEpaOTq9fDwAMQhXLQPT/4S4pEexAiaG/keBJNuJMrdPD1y0jLSeba29lZ6+obsHSVVvp2j26q0zB0eMsAIWj+Lj3t7+P7+gdU2dvZlgUEhwh+++msia1ubEScXN6/CohJeWESMsZ29c4Obp9+Mk6sXe+bc5c707DxY4wmob92Cu6fHCqqAMXt7+1AEUU3Pnz//3Ua+m4YmUaQRTw7nb//4449ZQvnLy8ucBCD7HHUqQ2VZ6/0O6tlHm0wbT4xGaodStigtmzJ8KOCDKqC1oqJiQ/0PSZ0inlhBhtaJRFPX0tpqyNnFbQBfzMUr4iNUPUT5FtduSJSIXLw41P9kADIys70KCkrlnJxdFzfy3Rsiv4AAl5sSN7uRWztDQiLzoqPjDa3sHUcsrB3mJWUV2h1dPZjlFT7562lsKYMPS4B2+SG0BDoRpGVt9PtbWlrOHTx4cI3csOSYoaQKUguUkoXMwTty5Mgqiur29V4fVVUaNV8gcU9Nl8j+J+cPefuo+hZB3xoygekm3AcFwFhkWHdlVdWZS6Kizw2NTIT4Ym4r3B2KT0pnRS9dnTp7XuSho7PTEDWMNjG1qAsKDr3v7e2XutHvXzcR50ZGRi56enobDw6+4MXHJ5qjRHDU1NTLKCuvFsjeVpyurKpj4csvwdvHD8Gh8rK/f1BKU2uTaFFRgdZmrAFt/EfIUMK9e/ey1C+HpMHw8DC3Qf39/WQZ8H/4Kt9OZmZmnPVCdj/qec6ZROYfVd7iZrGoajYlE8nHx+uFmZnJKtr1Q9q6OmW4yYv+AYGVrm4eQm+fgFVvn0Dm5MnTQ8EhYSsLi8vCyqoaYU1NzQWUTuyWt+RH8Vjr7u5pHhYWMZ2YmJKbnpV11crGPpgmjl64KPaitq6JS+dqaGymdKYFMwurttKK0mt4UqVJxG70+wkB40lcof54aIqx+HMZUTpbWFhIqdl8Ss5Yb7iUSrBRLHNgjwplCWOQ+KcGTMgU/M7Ozs83Yf3/EB4euowvo9t3brcqKCm2NTY3cWN8paRkHtNInlOnz89eEr0yaGRsujIzOw+lZRW83t7enfjsn270+zdMDQ0NJ1DnalpYWNY1N7cuIjgx1dbWi6Fx82gWzkXHJLD327sYqvvv6u5hFBTvdjg4uMTT51DE5m7GGtD2dhkaGmIpp05ERISHDMFQWBhF9gyKaP6LFy9eOUeePH+0+aTryYtI4d2vHEBdXV3k9u3fjLUjE53x8fFZra6uFr0lLfVQR1+3BEU76+Lqzpe9Lf8Anx9z5uyFMQSEU3fkFZ9Q3WRmVs4AjfNBQH1tM9awYVJRUa3X1tbNISbIzMy5iSaMvoqqWr6BgdGoopLaKIWLadJYXX0jExIaMWtkbNIYEhKa3NbWeQFPqtFmrAGZ4CFuDPni2WPHjs1YW1svkL+eTDhUU9+ckvUDlJ+fnx4YGMid/G3btnHmH7VlIcYiKbAZaya3NGIKPm6mKKqXRTV1zeycnPz5yKgY5pakdENoWMTyTQmZcWUVjSX8v6WOzi5m4MmgUFNTuwCtoIHNWMOmkL29Y6WVlU0g2qTZycnJVQiabqPorUXbuOyauMQzO1snfmpKlpDKvPv6nzAOTq4hpiaWA01NreLx8fEVm+HIoGlYysrKA+QYQgkwd+nSpQnKt0fQSY4b9lW9j8g4E9RnD5mJc/8SsCR1QtE+fX39Tck1QDWYZ2fnwCsru3ddROTiMFpLA6QqZWTlJuUVlNrCI6KEeNqF8vKKw45OLgs1tfWUAPtUWub2nImJydZlA/81UbBGXPz6Ep58Wzs7u3wEYBUmJkYFRkYGVZmZ2cunT4v0BgVG8qgfwPDIBGtobPE0Jio+IDQ03BsBVQM+6A1bBEQIioII+KGtzqIVMEH2u7m5OR+lAdPT0/PSQ6yo4IX8/mRZUMYPmYJkBpJKQDNwbjPWitevNzIyWkxKSlU/ceLUoqLi3Rk3d8/56Jg44eUr4m3UV+GuitoDTy+fhbj4RAH+FCITFKMKrUPp8JQGSW3GOjaNUNc64+YXoo6k5gQP8MGXGhgYVJqYmPoHBYcsoAUwkpScwV9YXKNmSHxNLb0JtGEnh4en3m2937Y6ONj3wUbXQKccT8YM+QNUVVX5CJKohOo5+fBRKoW+7HUqKyuVqbZv9+7dHPKngU1kCVBnDgJfm7DOf0STeAqtjCRNTa2affsOLGbhSQ8Pj+Srq2suozRd0Nc3nOnp6eP7+QXM2NjYd+NzzcFnOooWzxQyj9VG1/BaSE1NjVK+3J2cnKLx1e3h4VGBi0/z9va1M7ewqvXyCZjPzMrjP38xyjQ132cio2J5bh5e01VVtRKoczs2Y6AEAtKSBw8eMNRKBUV2HT7kebLjExISXtpjhih/jiQA2f4k8qlip6mpiULB39kr6WUJTdR37e3tF5FRG21tbR9cuHBpLSYmjjaeWvMviIvfeGhtbTvb29vPQ6ZA6yDSJCQkPBPxSDyqMp6bm1vSRtfw2oiGTyJn16Ik8PX29k5DVVDl6uZZY2RinuPh5WOBYq0sKzuXT00fyEw0M7deRYDIi4qOH0I10IUb1bjRNVCUkkKzFLdHsNaLyF1AJiFl67zsNag7GjENRRnJ8UPXoiggWgR3Nro+PMXzqJ6G8BnNnD9/nqGqKATLS6gO+efOiTzX0NDujoiImn70qIcxNjaNMDQ0fubl5eOJ60G+DBOgKntvo2t4rUS2qT9SbGysPSJnN29fv0cuLu5luPlZjs7ObvqGBhO0+dQNpLHpPpo7XgIKHefnF2nm5OTNVlVVqW50Dbhx49PT03R6V69cuTIdFxe3+kONrv6cyN1L3kWK85MqoCpkkgQbnXGApq88XnMFscWUiooKu2fPntXCwmKhkZHJKjLBmqys3Libm8dwV1c3o6CgVK2nZ9ATFBQcgQx8BxmxW0lJ6cc/kZUKJfHkxyEPeCAyl/MPCAr08PRuQtt2wNPb28/OySHM2ydgOSe3kGlu6WCLiitYWztnhpjC2MT8cW/fAGvv4PRsI2sgEEdNksiEu3PnTpKsrOzi1atXXzo8TKeeEj8p8EMWAFX1oEVxfiNrIpUoLi4uxJeAVAuefkFHRwfj5OSy5unpLTh69PgIivkFxBs8aWnpSnV19cd4mHLb2tr24uk30tDQeDo2NraubKY3TngjaZT/h6dHOTg4xAPRbQJKgnZjE7N2I2PTGMW7av2eXn48yiFABoDwiFiWhh9TCTmVltOc29z8fKuNrAE38T4hd9y8Z/iwF8mt+7Kf9fHx4bJ8qeiDmAjV2oY6keBGX5OSkiL/BEMBJGRKluL5+JyENjZ2gmPHTizJycmP4qHhBQQELKDKeYSWSy9KUaXU1FQTxFLdg4ODRzeyhjdOqIezUYzGo2lYhEAwz8bOvsLGzqE3NCxi+sLFKy1XxW+OU5/g5JQMdnxiBsLCo7n2aU+fPee6ZZDHiwJIz58/37/eNeDp4TppoxoQEAO8bB9iAoAUTaSf3d3d8G3dOF+GFhcX/+U/M5o5a4ISR8mZhJKRxdPNWlpasgcPHl5RUlJesLd3pAzfQWVl5UYEes/wM1HFxcUXEFTfQ+T/4wV+30VoMgUgAMPD5DPq6elZjTechyjwgYmp+aiKhtbIrs/2DiuraPCKS8q4Hjo8vpASHWF4ZIwrhUazkWsQ4e3j941euC9LeHL5lCGE9vZzsuWfPXv2UsMTCABSti/F/Mn1u57vJrK2tVmNjY/jGmJQv0Mvb1+uPxD9m9LaP/3sc+bSlcsUzSSzdRElw3MtLa0utBIqoqOjLZGBD6IpvUQqbb1r2FJCLs7HBzhNeQD487GpqVmxhqb2kI6B8aK+sdnqu+99tHrm7HnG3d0T7lVWc3MGvxqDNju3xLVSo5Yx1EIFTaGEV/1+qhGgpE0UvTzy478siKNwL6V/UaIpiulXTrlGqbVbW1dHQC1wNLQ0uYZWtOHUAykxKYWb8kkdQC5cFGUMjY0YOTk5HoJClARKfXhQBvFZZdLpRyk6PD4+vvWNoNZLfX19HyB3TyEX9yMzRGhp6Qxr6+g+o8phbX0j3uUr16j8W4hikKEaQyrzojaxNASR8gmpH4ChkRn4+AYCVcM8ePDo3KuuAS0CR2qv/ionmQAgRQAlJSVfuRUdhWcVFBSEqelpYGVtBR0POrl2OLT5lCZ/+MgxOHtOBPQNjEBHV5+RlbvNoFXAR9G/qq2tPYnSihgAVaePN1oeG0oz+1FQaGioEd0YjZtRVdUoUVVVn7F1dBEYmVnyff2CGGoJ85vf/I49fuIUREXHchW/lE1MDZKpffrw+BTXQFFBUYXrH1hcXBrwqmtAHTotKir60r2E0FRbOHDggOBVU8ufPHnyKer8KcpOlldUgNb7bdDQ1Mg1sBh8PsSVsNFQR2KGu8qqnGo4dOQwo6amJkQG4OGJX0bssYgvT/x9nlLvX/Vef3RUUlJyE6UATRkbk5NTKL8qfr1VUvbOipuXL+Pg6MpSB1Bqof7O79/l2qbRyaAcAhqcYGxiAd7+QVzjRCoHl1dQ4hpDJCSlVGz1ff01IcATpxIxchtTlTKd/Jq6WqiovAc0IIuaYxEjUB9EkgBHjh4HKWlZ6prGIgOwqAYEIiIiCygtF1EV8Lak4vd1ECU8IEcnFRUVXZOXV6y8efNWz2d7988qq2sJUQKwKqrqEI7AiJojUrPIAwcPg/g1Ca4X0JOnL8DUygZoIPXQ2CT0DwxyDRapHtDRyeVHEw1DrGBGhaLkQaSkVGoN1/34ETx42MVJATNzK1DX0OIGPVPnb1o/jX0nKaCipkpp7OyuXbuYc+fOrVJtQWZm5puv9XudVFZWdsvY2HhQUlK6l+r5qZrol795h49gkFVUUQfEBEAlZebWdrD/8DEQvXodTpw8y3UJI4uATERqpryyzIeF+RVQVdHkpEZBYTFMTq7PRNsMoiYZN2/e5NLTyXNIdQkI2jhzj8zZroePuDa41L2E+h/TXF/6nUAmFZqQe5pyDRCnsPh82Nu3bwvweq9UPPuTICqVQjtcICMjN/TocS8cOnyct/fAYYGqpg57WfwGaOkacUygrq0H129Jc00S9Q1MuJ66hAUIE9AIVWoKReVm1FGcWqiJX7tBD5Ttffbs/S24p3+ytrYeoW5gBDCpUodaw5LfgH6SqUdtbenkE7ilf1M1M0k8qjGgzmG0+VRdRA0lKIcRJQCLKnND6eU/WsITUm9gaMzu239QaO/gBOUV1VyrN+qHT5sufVuRm5Ktb2SOf4+Ay1euo0r4FMWkOupKOa6nPuECUzMrbio5tZCn6mMyG8lCSE5OfakmDJtBuMkHKU2Mqp3IzESwxm0i5R88evSISx2jglWuw7m1LefUoh5HpOLMLazIL8E1jSRGIQaiHAayVBA8bqhg5kdNAQEBRSdOnuZt275TqK2jBxZW1gSCZn18A+6hXl+i6RlS0tQsOgtPvSM3N09eQQW27/gYpGVuc0xA7mLyD1Bn8fqGFu53OlVGxqbg5xdAWOJbm09tJuEJVaVCFCoPo8HM1HuATj8hfzr9lEVM+QcaePJpBhB1Nyc/x07cfEXFu1y3cAovv3jxgos4Us4hSYNXCVb9JCk4ODjlvMhFIW6mEE0+htD+V44ZAoqf7dm3SpMxJG7J4KkOBg9PX05CkFuYLAQyobS09Tlc8ITrlaPPdQ2l5tEUO6Bmyh4Isrq7e15btwwqNaPOIOQgou4j1P+PTn1ycjINcOA2lNzHVEBCG0tYgErIP/74Y6517N69e4GmhRJgJDVA5ew02o2ij5cvX153+vpPgnx8fPJMzSwoo5UVF7/OUhn3X78nNjZWjVKxqV2qta0NUGfxvKJC0DMyhlPnznPq4sPtn0BGdgGMTc5xLWRp2gaphtUVATdYKRXNrJiYGKoL/JfNWjsxKJ74csoJpERT2miapUQ5h1SPSNXC1A7W09OTqpO5F0kB8vtTIyk64RRgotoCei91FKWIIDEJJZsSAzU2Nh7YrPX+KAmBUi31wI1PSOLJyNwW7N69e/bb3rdr107e+x++B9KyUqCsehetA3sIiQjnmOAPH2yDfQePwfmLYhATnwKdDx7DzOwi1zW0C/89N7cARUUlnCmWlpb2yp1IvotcXV3HaMPIvqdNf/78ObfBxASUJ0iJI8QYtPEECKlRFaWQkbSgngVUQUyYgZpJf/LJJ1x1MZWV05hXyjymz27WWn+0ZGNj84DCoJaWljSKnh7Ad8bnQ0JCKsipQsGYI0dPgvhNSTCxsAYDYwu4el0Sdu/ZD+I3pEBKVoEbt7awwuOmjZAqeNDVDR1dPVDb2AIePv6ogwd2r3fNlLuH655uamqBQjQ56efQyDBExUTD4/4+/O5M7tTTKadOIfn5+VzyKEmKDz74gAN6BO5+85vfUPsana8KVDo7O/eS+KciVpIcyFzl613jT4YcHBwenj17dg3t33ZEwczJkye/bxbhP9CDpFQsGqdCc3NuSMqAhbUDGJlawcHDJ9kPtu2CS2gpkP8gNDIGqIsm9QoiV3J1XTNQZTINXaDBDOutDJKRkVmg06urq88NbHr0qAcCggLhxfAQ15aOJp+QLie9T6KddDzp+nfeeYfrF0SSABlgcmBg4Bv9EHbs2DFDWcckIfCz+utZ30+K8FSnoujTwZPPO336NJ/StL4vOof2cTJl5JAFEBASCp/s+YL9fP8hMDa3AoW76tzrpuRtIEeS2HUJKC5BfTw+yUUOae4uxRHyC0rA2MSMO5mI1L942bVSQAfFuoD0M51Q8twFBoWAs4sbh018/f3Axc0VklKSORVAZWm///3vKQeRxY0lWx5+97vfwffNWsLrRiD4E1LY+enTp//xqs/zJ0dUDk6tVKhjNup/Af77e3U0MQeCqCUtbV2wtXNg0VRkURqw+w8cZs0tbLiBy8QEZ0QuIUC8wEUNKaI4N78I1L+YLARigrr6Rm6D6JS+rCSIiYkTWKC9Tt7GtLQMqtPjRtmQK5fa0VGULycvl2MEyhii0DFKK8rxYyh/EJlA2NDQcOH7vgMPgPW+fftWyGLYsg4fb5qkpKQWCaDRRC3KePmh91NL+S/2HSAzkBW5cIk9c/YC+9G2j1kauKimrs0xgMwdRThx5jw3f1fs6jUuYjg1jbZ512POT0CuZwMjQ7hw6SKERYaP/lBOQG5uviaZk7T5NOrN2NiUm0lAnjxKTjGzMOeaQxFwI/1OwI7K0ZCphYTut2/fzlD79x+6N2IAUhN1dXXkSPr5KzzGnza9ambt1NSX/4xMwJC379Tps5wEkFdQZslFbGXrBKfPX+ReNG7t4KEjcFtOHhoa27i5AvRCq4OLzBmbmiB2OMS1c0WR+43U6j8GrZxGaEhzdHQsN+SJdH9GRhbkFBRyk71U1TQgISmRQ/uI4LmsoW3btjHUqCogIICqiB6/bPbSrVu3yshjSN5AVFGbUh/5N0uFhaVH/PwDF8mvHhAYDFwaWXY+OLi4g7a+EcgpKnMMcObsefx5AXS0DYDmFAmEXwKVU/f09nPTuWhSGQE1AwODb/ggDA2Nh86dE+GGO5EXjyZ00aAmeh0+foLz6ZM7t/xeBdeRlNTKH/7wBwr/sigR2J07d75S23a0EmaonTy5kCkJZNMe1t8yUYIGpUjb2tqy1PWzEG3+Tz/7nAN+lGqlq2fEzRqisazkVSQmabv/4Ot5QxSdk5WTgQOH9hOIW/jqtEZGRaZR0snlK9e4IRSEO8hpRZji0OE/NqCm3gA1NTVcFzLqFIL6m6UW8Sj6F5uamo696r2Qj+Dx48ecT4H6DWy05uDvjlDPbr+jcKcvIzP763w7Gr1Oo1gpiqitY8DFDGgmMU0ftbCy5UzE4dEhiIyOgIGnT8DWwf55UkpSAGXtWFnbc1LDxdWTi9lT0Ibwx+07ctwIOHL/Enah0e3vvfceFwfAU8zHdfz6VddObfIIDBMwpXJzutZGWuf9XRM5a774Yv9je3tHakoJFy9c4WYK0exBkggEGCnySH4CGjwZHhkBDLBQ11APQpYBal+jpaONwHGWa2hFKoayjmiqmYmZKahranCxfjJJaeATBW3IrET0P7he/0JERIQS5QRQ6Tl5EanVHTLBmc1+Nn9X9NFH25cJuW/btgOOnzjDnXjyIqpr6ICVlR3k5hVxWccUVKKZQwIhyzECOXUEjBD/9SUkJadyo+oJRxiZGHNDLqkhEyWJ0uZTIIfiAAT8NjKlw8zMzJQcQOQIovgAeRM7Ozt/3DV/P3YiHbpv34GRS5cuw7vvfYTi+xCqBQ3Y/eletA6OgbOLBywsrkJzSxvQyJXVNT53+kkKIF9wnj5zcys0T905M4+QPsX6acbfhx9+yIl/+tv7778vWE8j6D8nNP2OkZeT/AdUuIJ44i0G2CxSUFDsPHvuIgcGP/hwB3h5+8Oez/eDjq4hB/Ji45I4dUCzjsi7p6B4lzvp1M62s7OL6zlM2TkE+jQ11eHnP/9XLnpH/n5E/5s2pRRVSdWhQ4eWULrMvt38TSYFBeXiU6f/6ByiuYOUjfvhR9u56SLkLCILoe1+FzwbHOHcxzSDh8q3KH5PhaC0+dQZlNy5FLunl7S09I+/Mvct/YmGpqd/QaNqaV4xAbrgkAgOG/z6P37LqYN339sGjk7uCPjucSVpVP5NXrmvxr3S5lOKN6H+srIyka2+n7e0DvLw8fIVuXCJklBRAuwEE1MrDhNs3/EJl2z62Z59XMYRZRdTnJ+6ipBrlxw8pAZI/1Ox5lbfx1vaAOXm5t+WkrzNmYdHj5wCGjhFFsLOjz/lJANJCbk7CuTD50K5FIYmVO7s7ExZPEFbvf63tAmUk5Mve+LEKTh39iL87rfvgqyMPJe3RyYYhW6phQwloJDYp79TO3g7O7uIrV73W9pECgkJkb158xbs33cY/vD7D7gRNkFBAZyTh5I6fvGLX3A/KUXLyckpbKvX+5ZeA3l5eel++ukekJOTB0lJCTA1NebSuKn/P7llSfzr6+tnb/U639JrJF9fX3Py6lFFDvUBpIwf8srt2bOH0rRrtnp9b+kNELlxKWGT/Pt06skvPzw8/MutXtdW0P8El6AzbTxNwPoAAAAASUVORK5CYII=';
    let _connected = false;
    let _publicKey = null;
    let _account = null;
    let _reqId = 0;
    const _pending = new Map();
    const _listeners = {};
    let _connectInProgress = null;
    const _wsListeners = { change: [] };
    class PublicKey {
        constructor(value) {
            if (typeof value === 'string') {
                this._base58 = value;
            }
            else if (value instanceof Uint8Array) {
                this._base58 = _encodeBase58(value);
            }
            else if (value && value._base58) {
                this._base58 = value._base58;
            }
            else {
                this._base58 = String(value);
            }
        }
        toString() { return this._base58; }
        toBase58() { return this._base58; }
        toJSON() { return this._base58; }
        toBytes() { return _decodeBase58(this._base58); }
        equals(other) { return this.toBase58() === (other?.toBase58?.() || String(other)); }
    }
    const BASE58_ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    function _encodeBase58(buf) {
        let num = BigInt(0);
        for (const b of buf)
            num = num * 256n + BigInt(b);
        let s = '';
        while (num > 0n) {
            s = BASE58_ALPHA[Number(num % 58n)] + s;
            num /= 58n;
        }
        for (const b of buf) {
            if (b !== 0)
                break;
            s = '1' + s;
        }
        return s || '1';
    }
    function _decodeBase58(str) {
        let num = BigInt(0);
        for (const c of str) {
            const i = BASE58_ALPHA.indexOf(c);
            if (i < 0)
                throw new Error('Invalid base58');
            num = num * 58n + BigInt(i);
        }
        const hex = num.toString(16).padStart(2, '0');
        const bytes = [];
        for (let i = 0; i < hex.length; i += 2)
            bytes.push(parseInt(hex.substr(i, 2), 16));
        for (const c of str) {
            if (c !== '1')
                break;
            bytes.unshift(0);
        }
        return new Uint8Array(bytes);
    }
    function emit(event, ...args) {
        (_listeners[event] || []).forEach(fn => { try {
            fn(...args);
        }
        catch (e) { } });
    }
    function makeAccount(pubkeyBase58) {
        const pubBytes = _decodeBase58(pubkeyBase58);
        return {
            address: pubkeyBase58,
            publicKey: pubBytes,
            chains: ['solana:mainnet'],
            features: ['solana:signTransaction', 'solana:signAndSendTransaction', 'solana:signMessage'],
        };
    }
    function sendRequest(type, data) {
        return new Promise((resolve, reject) => {
            const id = ++_reqId;
            _pending.set(id, { resolve, reject });
            const detectedWalletNames = _detectedWallets.map(w => w.name);
            window.postMessage({ type: 'wo-provider-req', id, action: type, data, detectedWallets: detectedWalletNames }, '*');
            setTimeout(() => {
                if (_pending.has(id)) {
                    _pending.delete(id);
                    reject(new Error('Request timed out'));
                }
            }, 120000);
        });
    }
    window.addEventListener('message', (e) => {
        if (e.source !== window)
            return;
        if (e.data?.type === 'wo-wallet-disconnected') {
            const disc = e.data.origin;
            let shouldDisconnect = (disc === '*' || disc === location.origin);
            if (!shouldDisconnect && disc) {
                try {
                    const discHost = new URL(disc).hostname.replace(/^www\./, '');
                    const pageHost = location.hostname.replace(/^www\./, '');
                    shouldDisconnect = (discHost === pageHost);
                }
                catch { }
            }
            if (shouldDisconnect) {
                _connected = false;
                _publicKey = null;
                _account = null;
                provider.publicKey = null;
                provider.isConnected = false;
                _walletStd.accounts = [];
                _wsEmit('change', { accounts: [] });
                emit('disconnect');
            }
            return;
        }
        if (e.data?.type === 'wo-use-original-wallet') {
            const name = e.data.walletName;
            const entry = _detectedWallets.find(w => w.name === name);
            if (!entry)
                return;
            _connected = false;
            _publicKey = null;
            provider.publicKey = null;
            provider.isConnected = false;
            if (entry.origConnect) {
                const f = entry.provider;
                f.connect = entry.origConnect;
                f.disconnect = entry.origDisconnect;
                f.signTransaction = entry.origSignTx;
                f.signAllTransactions = entry.origSignAllTx;
                f.signAndSendTransaction = entry.origSignAndSend;
                f.signMessage = entry.origSignMsg;
                f.request = entry.origRequest;
                f.isWhiteOwl = false;
                f.__woWrapped = false;
                entry.origConnect().catch(() => { });
            }
            else if (entry.wsWallet && entry.origFeatures) {
                const origConnect = entry.origFeatures['standard:connect']?.connect;
                if (origConnect) {
                    origConnect().catch(() => { });
                }
            }
            return;
        }
        if (e.data?.type === 'wo-provider-res') {
            const { id, result, error } = e.data;
            const p = _pending.get(id);
            if (!p)
                return;
            _pending.delete(id);
            if (error)
                p.reject(new Error(error));
            else
                p.resolve(result);
        }
    });
    const provider = {
        isWhiteOwl: true,
        isPhantom: true,
        isSolflare: false,
        isBackpack: false,
        isBraveWallet: false,
        isCoinbaseWallet: false,
        isExodus: false,
        isTrust: false,
        isGlow: false,
        isConnected: false,
        publicKey: null,
        _handleDisconnect: function () { return provider.disconnect(); },
        version: '26.3.1',
        _events: {},
        _eventsCount: 0,
        _responseCallbacks: new Map(),
        on(event, fn) {
            if (!_listeners[event])
                _listeners[event] = [];
            _listeners[event].push(fn);
            return provider;
        },
        off(event, fn) {
            if (!_listeners[event])
                return provider;
            _listeners[event] = _listeners[event].filter(f => f !== fn);
            return provider;
        },
        removeListener(event, fn) { return provider.off(event, fn); },
        removeAllListeners(event) { if (event)
            _listeners[event] = [];
        else
            Object.keys(_listeners).forEach(k => _listeners[k] = []); return provider; },
        async connect(opts) {
            if (opts?.onlyIfTrusted) {
                try {
                    const res = await sendRequest('connect', { onlyIfTrusted: true });
                    if (res && res.publicKey) {
                        _publicKey = new PublicKey(res.publicKey);
                        _connected = true;
                        _account = makeAccount(res.publicKey);
                        provider.publicKey = _publicKey;
                        provider.isConnected = true;
                        _walletStd.accounts = [_account];
                        _wsEmit('change', { accounts: _walletStd.accounts });
                        emit('connect', _publicKey);
                        return { publicKey: _publicKey };
                    }
                    const err = new Error('User rejected the request.');
                    err.code = 4001;
                    throw err;
                }
                catch (e) {
                    if (!e.code)
                        e.code = 4001;
                    throw e;
                }
            }
            if (_connectInProgress)
                return _connectInProgress;
            _connectInProgress = (async () => {
                try {
                    const res = await sendRequest('connect', {});
                    if (res && res.publicKey) {
                        _publicKey = new PublicKey(res.publicKey);
                        _connected = true;
                        _account = makeAccount(res.publicKey);
                        provider.publicKey = _publicKey;
                        provider.isConnected = true;
                        _walletStd.accounts = [_account];
                        _wsEmit('change', { accounts: _walletStd.accounts });
                        emit('connect', _publicKey);
                        return { publicKey: _publicKey };
                    }
                    const err = new Error('User rejected the request.');
                    err.code = 4001;
                    throw err;
                }
                catch (e) {
                    if (!e.code)
                        e.code = 4001;
                    emit('disconnect');
                    throw e;
                }
                finally {
                    _connectInProgress = null;
                }
            })();
            return _connectInProgress;
        },
        async disconnect() {
            _connected = false;
            _publicKey = null;
            _account = null;
            provider.publicKey = null;
            provider.isConnected = false;
            _walletStd.accounts = [];
            _wsEmit('change', { accounts: [] });
            emit('disconnect');
            try {
                await sendRequest('disconnect', {});
            }
            catch { }
        },
        async signTransaction(transaction) {
            if (!_connected)
                throw new Error('Wallet not connected');
            const serialized = typeof transaction.serialize === 'function'
                ? Array.from(transaction.serialize({ requireAllSignatures: false, verifySignatures: false }))
                : Array.from(transaction);
            const res = await sendRequest('signTransaction', { transaction: serialized });
            if (!res || !res.signedTransaction)
                throw new Error('Transaction rejected');
            return res.signedTransaction;
        },
        async signAllTransactions(transactions) {
            if (!_connected)
                throw new Error('Wallet not connected');
            const results = [];
            for (const tx of transactions) {
                results.push(await provider.signTransaction(tx));
            }
            return results;
        },
        async signAndSendTransaction(transaction, options) {
            if (!_connected)
                throw new Error('Wallet not connected');
            const serialized = typeof transaction.serialize === 'function'
                ? Array.from(transaction.serialize({ requireAllSignatures: false, verifySignatures: false }))
                : Array.from(transaction);
            const res = await sendRequest('signAndSendTransaction', { transaction: serialized, options });
            if (!res || !res.signature)
                throw new Error('Transaction rejected');
            return { signature: res.signature };
        },
        async signMessage(message, display) {
            if (!_connected)
                throw new Error('Wallet not connected');
            const data = message instanceof Uint8Array ? Array.from(message) : Array.from(new TextEncoder().encode(message));
            const res = await sendRequest('signMessage', { message: data, display });
            if (!res || !res.signature)
                throw new Error('Message signing rejected');
            return { signature: new Uint8Array(res.signature) };
        },
        async request(args) {
            if (args?.method === 'connect')
                return provider.connect(args.params);
            if (args?.method === 'disconnect')
                return provider.disconnect();
            if (args?.method === 'signTransaction')
                return provider.signTransaction(args.params?.transaction);
            if (args?.method === 'signAndSendTransaction')
                return provider.signAndSendTransaction(args.params?.transaction, args.params?.options);
            if (args?.method === 'signMessage')
                return provider.signMessage(args.params?.message, args.params?.display);
            throw new Error('Unsupported method: ' + args?.method);
        },
    };
    function _wsEmit(event, data) {
        (_wsListeners[event] || []).forEach(fn => { try {
            fn(data);
        }
        catch { } });
    }
    const _walletStd = {
        version: '1.0.0',
        name: WALLET_NAME,
        icon: WALLET_ICON,
        chains: ['solana:mainnet'],
        accounts: [],
        features: {
            'standard:connect': {
                version: '1.0.0',
                connect: async (input) => {
                    const silent = input?.silent || false;
                    const res = await provider.connect(silent ? { onlyIfTrusted: true } : {});
                    return { accounts: _walletStd.accounts };
                },
            },
            'standard:disconnect': {
                version: '1.0.0',
                disconnect: async () => {
                    await provider.disconnect();
                },
            },
            'standard:events': {
                version: '1.0.0',
                on: (event, listener) => {
                    if (!_wsListeners[event])
                        _wsListeners[event] = [];
                    _wsListeners[event].push(listener);
                    return () => {
                        _wsListeners[event] = (_wsListeners[event] || []).filter(f => f !== listener);
                    };
                },
            },
            'solana:signTransaction': {
                version: '1.0.0',
                supportedTransactionVersions: ['legacy', 0],
                signTransaction: async (...inputs) => {
                    const results = [];
                    for (const inp of inputs) {
                        const tx = inp.transaction;
                        const signed = await provider.signTransaction(tx);
                        results.push({ signedTransaction: signed });
                    }
                    return results;
                },
            },
            'solana:signAndSendTransaction': {
                version: '1.0.0',
                supportedTransactionVersions: ['legacy', 0],
                signAndSendTransaction: async (...inputs) => {
                    const results = [];
                    for (const inp of inputs) {
                        const tx = inp.transaction;
                        const opts = inp.options;
                        const res = await provider.signAndSendTransaction(tx, opts);
                        results.push({ signature: typeof res.signature === 'string' ? new TextEncoder().encode(res.signature) : res.signature });
                    }
                    return results;
                },
            },
            'solana:signMessage': {
                version: '1.0.0',
                signMessage: async (...inputs) => {
                    const results = [];
                    for (const inp of inputs) {
                        const res = await provider.signMessage(inp.message);
                        results.push({ signedMessage: inp.message, signature: res.signature });
                    }
                    return results;
                },
            },
        },
    };
    let _realPhantomWrapped = false;
    const _detectedWallets = [];
    function _guessWalletName(foreign) {
        if (foreign.isPhantom)
            return 'Phantom';
        if (foreign.isSolflare)
            return 'Solflare';
        if (foreign.isBackpack)
            return 'Backpack';
        if (foreign.isCoinbaseWallet)
            return 'Coinbase Wallet';
        if (foreign.isBraveWallet)
            return 'Brave Wallet';
        if (foreign.isExodus)
            return 'Exodus';
        if (foreign.isTrust || foreign.isTrustWallet)
            return 'Trust Wallet';
        if (foreign.isMathWallet)
            return 'MathWallet';
        if (foreign.isCoin98)
            return 'Coin98';
        if (foreign.isSlope)
            return 'Slope';
        if (foreign.isTorus)
            return 'Torus';
        if (foreign.isLedger)
            return 'Ledger';
        if (foreign.isMagicEden)
            return 'Magic Eden';
        if (foreign.isGlow)
            return 'Glow';
        if (foreign._name)
            return foreign._name;
        if (foreign.name)
            return foreign.name;
        return 'Other Wallet';
    }
    function wrapForeignProvider(foreign) {
        if (!foreign || foreign.isWhiteOwl || foreign.__woWrapped)
            return;
        foreign.__woWrapped = true;
        _realPhantomWrapped = true;
        const walletName = _guessWalletName(foreign);
        const origConnect = foreign.connect?.bind(foreign);
        const origDisconnect = foreign.disconnect?.bind(foreign);
        const origSignTx = foreign.signTransaction?.bind(foreign);
        const origSignAllTx = foreign.signAllTransactions?.bind(foreign);
        const origSignAndSend = foreign.signAndSendTransaction?.bind(foreign);
        const origSignMsg = foreign.signMessage?.bind(foreign);
        const origRequest = foreign.request?.bind(foreign);
        const existing = _detectedWallets.find(w => w.name === walletName);
        if (existing) {
            if (!existing.origConnect) {
                existing.provider = foreign;
                existing.origConnect = origConnect;
                existing.origDisconnect = origDisconnect;
                existing.origSignTx = origSignTx;
                existing.origSignAllTx = origSignAllTx;
                existing.origSignAndSend = origSignAndSend;
                existing.origSignMsg = origSignMsg;
                existing.origRequest = origRequest;
            }
        }
        else {
            _detectedWallets.push({
                name: walletName,
                provider: foreign,
                origConnect, origDisconnect, origSignTx, origSignAllTx,
                origSignAndSend, origSignMsg, origRequest,
            });
        }
        function _safeOverride(obj, prop, fn) {
            try {
                obj[prop] = fn;
            }
            catch { }
            try {
                const d = Object.getOwnPropertyDescriptor(obj, prop);
                if (!d || (d.value !== fn && d.get !== fn)) {
                    Object.defineProperty(obj, prop, { value: fn, writable: true, configurable: true });
                }
            }
            catch { }
        }
        _safeOverride(foreign, 'connect', function (opts) { return provider.connect(opts); });
        _safeOverride(foreign, 'disconnect', function () { return provider.disconnect(); });
        _safeOverride(foreign, 'signTransaction', function (tx) { return provider.signTransaction(tx); });
        _safeOverride(foreign, 'signAllTransactions', function (txs) { return provider.signAllTransactions(txs); });
        _safeOverride(foreign, 'signAndSendTransaction', function (tx, o) { return provider.signAndSendTransaction(tx, o); });
        _safeOverride(foreign, 'signMessage', function (msg, d) { return provider.signMessage(msg, d); });
        _safeOverride(foreign, 'request', function (args) { return provider.request(args); });
        try {
            foreign.isWhiteOwl = true;
        }
        catch { }
        try {
            Object.defineProperty(foreign, 'isConnected', {
                get() { return provider.isConnected; },
                set() { },
                configurable: true,
            });
            Object.defineProperty(foreign, 'publicKey', {
                get() { return provider.publicKey; },
                set() { },
                configurable: true,
            });
        }
        catch { }
        if (typeof foreign.on === 'function' && !foreign.__woEventsWrapped) {
            foreign.__woEventsWrapped = true;
            const origOn = foreign.on.bind(foreign);
            foreign.on = function (event, fn) {
                provider.on(event, fn);
                return foreign;
            };
            foreign.off = function (event, fn) {
                provider.off(event, fn);
                return foreign;
            };
            foreign.removeListener = function (event, fn) {
                provider.off(event, fn);
                return foreign;
            };
        }
    }
    function wrapAllForeignProviders() {
        try {
            const phantomDesc = Object.getOwnPropertyDescriptor(window, 'phantom');
            if (phantomDesc && 'value' in phantomDesc) {
                const ps = phantomDesc.value?.solana;
                if (ps && !ps.isWhiteOwl && !ps.__woWrapped)
                    wrapForeignProvider(ps);
            }
        }
        catch { }
        try {
            const solDesc = Object.getOwnPropertyDescriptor(window, 'solana');
            if (solDesc && 'value' in solDesc) {
                const ws = solDesc.value;
                if (ws && !ws.isWhiteOwl && !ws.__woWrapped)
                    wrapForeignProvider(ws);
            }
        }
        catch { }
        try {
            if (window.solflare && !window.solflare.__woWrapped)
                wrapForeignProvider(window.solflare);
        }
        catch { }
        try {
            const bp = window.backpack?.solana || window.xnft?.solana;
            if (bp && !bp.__woWrapped)
                wrapForeignProvider(bp);
        }
        catch { }
        try {
            const me = window.magicEden?.solana;
            if (me && !me.__woWrapped)
                wrapForeignProvider(me);
        }
        catch { }
        try {
            const cb = window.coinbaseSolana;
            if (cb && !cb.__woWrapped)
                wrapForeignProvider(cb);
        }
        catch { }
        try {
            const bw = window.braveSolana;
            if (bw && !bw.__woWrapped)
                wrapForeignProvider(bw);
        }
        catch { }
        try {
            const ex = window.exodus?.solana;
            if (ex && !ex.__woWrapped)
                wrapForeignProvider(ex);
        }
        catch { }
        try {
            if (window.glowSolana && !window.glowSolana.__woWrapped)
                wrapForeignProvider(window.glowSolana);
        }
        catch { }
        try {
            if (window.Slope && window.Slope.solana && !window.Slope.solana.__woWrapped)
                wrapForeignProvider(window.Slope.solana);
        }
        catch { }
        try {
            const c98 = window.coin98?.sol;
            if (c98 && !c98.__woWrapped)
                wrapForeignProvider(c98);
        }
        catch { }
        try {
            const tw = window.trustwallet?.solana || window.trustWallet?.solana;
            if (tw && !tw.__woWrapped)
                wrapForeignProvider(tw);
        }
        catch { }
    }
    function claimGlobals() {
        try {
            const existingDesc = Object.getOwnPropertyDescriptor(window, 'solana');
            if (existingDesc && existingDesc.configurable === false) {
                const existing = window.solana;
                if (existing && !existing.isWhiteOwl && !existing.__woWrapped) {
                    wrapForeignProvider(existing);
                }
            }
            else {
                Object.defineProperty(window, 'solana', {
                    get() { return provider; },
                    set(v) {
                        if (v && !v.isWhiteOwl && !v.__woWrapped)
                            wrapForeignProvider(v);
                    },
                    configurable: false,
                    enumerable: true,
                });
            }
        }
        catch (e) {
            try {
                const existing = window.solana;
                if (existing && !existing.isWhiteOwl && !existing.__woWrapped)
                    wrapForeignProvider(existing);
            }
            catch { }
        }
        const _capturedForeignSolana = { ref: null };
        try {
            const existingPhantomDesc = Object.getOwnPropertyDescriptor(window, 'phantom');
            if (existingPhantomDesc && existingPhantomDesc.configurable === false) {
                try {
                    const existing = window.phantom?.solana;
                    if (existing && !existing.isWhiteOwl && !existing.__woWrapped) {
                        wrapForeignProvider(existing);
                    }
                }
                catch { }
            }
            else {
                const phantomProxy = new Proxy({ solana: provider }, {
                    get(target, prop) {
                        if (prop === 'solana')
                            return provider;
                        if (prop === Symbol.toPrimitive)
                            return () => '[object Object]';
                        if (prop === Symbol.toStringTag)
                            return 'Phantom';
                        if (prop === 'ethereum')
                            return undefined;
                        if (prop === 'toJSON')
                            return () => ({ solana: {} });
                        return undefined;
                    },
                    set(target, prop, value) {
                        if (prop === 'solana' && value && !value.isWhiteOwl) {
                            _capturedForeignSolana.ref = value;
                            wrapForeignProvider(value);
                        }
                        return true;
                    },
                    has(target, prop) {
                        if (prop === 'solana')
                            return true;
                        return false;
                    },
                    ownKeys() {
                        return ['solana'];
                    },
                    getOwnPropertyDescriptor(target, prop) {
                        if (prop === 'solana') {
                            return { value: provider, writable: false, enumerable: true, configurable: true };
                        }
                        return undefined;
                    },
                });
                Object.defineProperty(window, 'phantom', {
                    get() { return phantomProxy; },
                    set(v) {
                        if (v && typeof v === 'object' && v.solana && !v.solana.isWhiteOwl) {
                            _capturedForeignSolana.ref = v.solana;
                            wrapForeignProvider(v.solana);
                        }
                    },
                    configurable: false,
                    enumerable: true,
                });
            }
        }
        catch (e) {
            try {
                const existing = window.phantom?.solana;
                if (existing && !existing.isWhiteOwl && !existing.__woWrapped)
                    wrapForeignProvider(existing);
            }
            catch { }
            try {
                if (!window.phantom)
                    window.phantom = {};
                window.phantom.solana = provider;
            }
            catch { }
        }
    }
    claimGlobals();
    let _wrapChecks = 0;
    const _wrapInterval = setInterval(() => {
        wrapAllForeignProviders();
        _wrapChecks++;
        if (_wrapChecks > 200)
            clearInterval(_wrapInterval);
    }, 50);
    setTimeout(() => clearInterval(_wrapInterval), 30000);
    const _wsWallets = [];
    const _walletProxies = new Map();
    function makeWalletProxy(original) {
        var name = original.name || 'Unknown Wallet';
        var origFeatures = {};
        for (var _e of Object.entries(original.features || {}))
            origFeatures[_e[0]] = _e[1];
        var existing = _detectedWallets.find(function (w) { return w.name === name; });
        if (existing) {
            existing.wsWallet = original;
            existing.origFeatures = origFeatures;
        }
        else {
            _detectedWallets.push({
                name: name, provider: null, wsWallet: original, origFeatures: origFeatures,
                origConnect: null, origDisconnect: null, origSignTx: null,
                origSignAllTx: null, origSignAndSend: null, origSignMsg: null, origRequest: null,
            });
        }
        var overrides = {};
        if (origFeatures['standard:connect']) {
            overrides['standard:connect'] = {
                version: origFeatures['standard:connect'].version || '1.0.0',
                connect: async function (input) {
                    var silent = input && input.silent;
                    await provider.connect(silent ? { onlyIfTrusted: true } : {});
                    return { accounts: _walletStd.accounts };
                },
            };
        }
        if (origFeatures['standard:disconnect']) {
            overrides['standard:disconnect'] = {
                version: origFeatures['standard:disconnect'].version || '1.0.0',
                disconnect: async function () { await provider.disconnect(); },
            };
        }
        if (origFeatures['solana:signTransaction'])
            overrides['solana:signTransaction'] = _walletStd.features['solana:signTransaction'];
        if (origFeatures['solana:signAndSendTransaction'])
            overrides['solana:signAndSendTransaction'] = _walletStd.features['solana:signAndSendTransaction'];
        if (origFeatures['solana:signMessage'])
            overrides['solana:signMessage'] = _walletStd.features['solana:signMessage'];
        if (_walletStd.features['standard:events'])
            overrides['standard:events'] = _walletStd.features['standard:events'];
        var merged = Object.assign({}, origFeatures, overrides);
        var proxy = new Proxy(original, {
            get: function (target, prop) {
                if (prop === 'features')
                    return merged;
                if (prop === 'accounts')
                    return _walletStd.accounts;
                if (prop === '__woProxied')
                    return true;
                var v = target[prop];
                if (typeof v === 'function')
                    return v.bind(target);
                return v;
            },
            set: function (target, prop, value) {
                if (prop === 'features' || prop === 'accounts')
                    return true;
                target[prop] = value;
                return true;
            },
        });
        return proxy;
    }
    function getOrCreateProxy(w) {
        if (!w || w.name === WALLET_NAME || w.__woProxied)
            return w;
        if (_walletProxies.has(w))
            return _walletProxies.get(w);
        var name = w.name || '';
        for (var pair of _walletProxies) {
            if (pair[0].name === name) {
                _walletProxies.set(w, pair[1]);
                return pair[1];
            }
        }
        var px = makeWalletProxy(w);
        _walletProxies.set(w, px);
        if (!_wsWallets.some(function (x) { return x.name === name; }))
            _wsWallets.push({ name: name, icon: w.icon, wallet: w });
        return px;
    }
    function _proxyWalletArg(a) {
        if (a && typeof a === 'object' && a.features && typeof a.name === 'string' && !a.__woProxied && a.name !== WALLET_NAME) {
            return getOrCreateProxy(a);
        }
        return a;
    }
    function registerWithStandard(registerFn) {
        try {
            registerFn(_walletStd);
        }
        catch (e) { }
    }
    var _origAddEvent = EventTarget.prototype.addEventListener.bind(window);
    var _origDispEvent = EventTarget.prototype.dispatchEvent.bind(window);
    var _origRemoveEvent = EventTarget.prototype.removeEventListener.bind(window);
    var _handlerMap = new WeakMap();
    var REGISTER_WALLET = 'wallet-standard:register-wallet';
    function _isAppReady(t) { return t === 'wallet-standard:app-ready' || t === 'wallet-standard:app-ready-event'; }
    Object.defineProperty(window, 'addEventListener', {
        value: function woAddEventListener(type, listener, opts) {
            if (typeof listener !== 'function')
                return _origAddEvent.call(window, type, listener, opts);
            if (type === REGISTER_WALLET) {
                var wrapped = _handlerMap.get(listener);
                if (!wrapped) {
                    wrapped = function (event) {
                        try {
                            var walletReg = event && event.detail && event.detail.register;
                            if (typeof walletReg !== 'function')
                                return listener.call(this, event);
                            var fakeEvent = new CustomEvent(REGISTER_WALLET, {
                                detail: Object.freeze({
                                    register: function (appRegFn) {
                                        if (typeof appRegFn !== 'function')
                                            return walletReg(appRegFn);
                                        return walletReg(function () {
                                            var args = [];
                                            for (var i = 0; i < arguments.length; i++)
                                                args.push(_proxyWalletArg(arguments[i]));
                                            return appRegFn.apply(null, args);
                                        });
                                    }
                                })
                            });
                            return listener.call(this, fakeEvent);
                        }
                        catch (err) {
                            return listener.call(this, event);
                        }
                    };
                    _handlerMap.set(listener, wrapped);
                }
                return _origAddEvent.call(window, type, wrapped, opts);
            }
            if (_isAppReady(type)) {
                var wrapped2 = _handlerMap.get(listener);
                if (!wrapped2) {
                    wrapped2 = function (event) {
                        try {
                            var appReg = event && event.detail && event.detail.register;
                            if (typeof appReg !== 'function')
                                return listener.call(this, event);
                            var fakeEvent = new CustomEvent(event.type, {
                                detail: Object.freeze({
                                    register: function () {
                                        var args = [];
                                        for (var i = 0; i < arguments.length; i++)
                                            args.push(_proxyWalletArg(arguments[i]));
                                        return appReg.apply(null, args);
                                    }
                                })
                            });
                            return listener.call(this, fakeEvent);
                        }
                        catch (err) {
                            return listener.call(this, event);
                        }
                    };
                    _handlerMap.set(listener, wrapped2);
                }
                return _origAddEvent.call(window, type, wrapped2, opts);
            }
            return _origAddEvent.call(window, type, listener, opts);
        },
        writable: true, configurable: true, enumerable: true,
    });
    Object.defineProperty(window, 'removeEventListener', {
        value: function woRemoveEventListener(type, listener, opts) {
            if (typeof listener === 'function') {
                var wrapped = _handlerMap.get(listener);
                if (wrapped)
                    return _origRemoveEvent.call(window, type, wrapped, opts);
            }
            return _origRemoveEvent.call(window, type, listener, opts);
        },
        writable: true, configurable: true, enumerable: true,
    });
    Object.defineProperty(window, 'dispatchEvent', {
        value: function woDispatchEvent(event) {
            if (event && _isAppReady(event.type)) {
                try {
                    var appReg = event.detail && event.detail.register;
                    if (typeof appReg === 'function') {
                        return _origDispEvent.call(window, new CustomEvent(event.type, {
                            detail: Object.freeze({
                                register: function () {
                                    var args = [];
                                    for (var i = 0; i < arguments.length; i++)
                                        args.push(_proxyWalletArg(arguments[i]));
                                    return appReg.apply(null, args);
                                }
                            })
                        }));
                    }
                }
                catch (err) { }
            }
            return _origDispEvent.call(window, event);
        },
        writable: true, configurable: true, enumerable: true,
    });
    try {
        _origDispEvent.call(window, new CustomEvent(REGISTER_WALLET, {
            detail: Object.freeze({ register: registerWithStandard }),
        }));
    }
    catch (e) { }
    try {
        _origAddEvent.call(window, 'wallet-standard:app-ready', function (e) {
            var register = e && e.detail && e.detail.register;
            if (typeof register === 'function')
                registerWithStandard(register);
        });
        _origAddEvent.call(window, 'wallet-standard:app-ready-event', function (e) {
            var register = e && e.detail && e.detail.register;
            if (typeof register === 'function')
                registerWithStandard(register);
        });
    }
    catch (e) { }
    function _discoveryCallback(walletObj) {
        if (!walletObj || walletObj.name === WALLET_NAME)
            return;
        getOrCreateProxy(walletObj);
    }
    try {
        _origDispEvent.call(window, new CustomEvent('wallet-standard:app-ready', {
            detail: Object.freeze({ register: _discoveryCallback }),
        }));
    }
    catch (e) { }
    try {
        _origDispEvent.call(window, new CustomEvent('wallet-standard:app-ready-event', {
            detail: Object.freeze({ register: _discoveryCallback }),
        }));
    }
    catch (e) { }
    var _promoteTimer = null;
    var _promoteWalletNames = ['Phantom', 'Solflare', 'Backpack', 'Magic Eden', 'Coinbase', 'Torus', 'Ledger', 'Jupiter', 'Trust', 'Exodus', 'Brave'];
    function _promoteWhiteOwl() {
        var candidates = document.querySelectorAll('button, li, a, [role="option"], [role="listitem"]');
        for (var i = 0; i < candidates.length; i++) {
            var el = candidates[i];
            var text = (el.textContent || '').trim();
            if (!text.includes(WALLET_NAME))
                continue;
            var parent = el.parentElement;
            if (!parent)
                continue;
            var siblings = [];
            for (var c = parent.firstElementChild; c; c = c.nextElementSibling) {
                if (c.tagName === el.tagName)
                    siblings.push(c);
            }
            if (siblings.length < 2)
                continue;
            var hasOther = false;
            for (var j = 0; j < siblings.length; j++) {
                if (siblings[j] === el)
                    continue;
                var st = siblings[j].textContent || '';
                for (var k = 0; k < _promoteWalletNames.length; k++) {
                    if (st.includes(_promoteWalletNames[k])) {
                        hasOther = true;
                        break;
                    }
                }
                if (hasOther)
                    break;
            }
            if (!hasOther)
                continue;
            if (siblings[0] !== el) {
                parent.insertBefore(el, siblings[0]);
            }
        }
    }
    function _schedulePromote() {
        if (_promoteTimer)
            return;
        _promoteTimer = setTimeout(function () {
            _promoteTimer = null;
            try {
                _promoteWhiteOwl();
            }
            catch (e) { }
        }, 150);
    }
    var _promoteObs = new MutationObserver(_schedulePromote);
    function _startPromoteObserver() {
        if (document.body) {
            _promoteObs.observe(document.body, { childList: true, subtree: true });
        }
    }
    if (document.body)
        _startPromoteObserver();
    else
        document.addEventListener('DOMContentLoaded', _startPromoteObserver);
    if (location.hostname === 'gmgn.ai' || location.hostname === 'www.gmgn.ai') {
        var _OrigWebSocket = window.WebSocket;
        var _WsProxy = function (url, protocols) {
            var ws = protocols !== undefined ? new _OrigWebSocket(url, protocols) : new _OrigWebSocket(url);
            try {
                if (typeof url === 'string' && url.indexOf('gmgn.ai') !== -1 && url.indexOf('/ws') !== -1) {
                    var isTwitter = url.indexOf('twitter_monitor') !== -1;
                    window.postMessage({ type: 'wo-gmgn-ws-captured', url: url, isTwitter: isTwitter }, '*');
                    if (isTwitter) {
                        var _relayBuf = [];
                        var _relayTimer = null;
                        ws.addEventListener('message', function (ev) {
                            try {
                                var d = typeof ev.data === 'string' ? JSON.parse(ev.data) : null;
                                if (d) {
                                    _relayBuf.push(d);
                                    if (!_relayTimer) {
                                        _relayTimer = setTimeout(function () {
                                            _relayTimer = null;
                                            var batch = _relayBuf.splice(0);
                                            if (batch.length) {
                                                window.postMessage({ type: 'wo-gmgn-ws-data', items: batch }, '*');
                                            }
                                        }, 500);
                                    }
                                }
                            }
                            catch (ex) { }
                        });
                    }
                }
            }
            catch (e) { }
            return ws;
        };
        _WsProxy.prototype = _OrigWebSocket.prototype;
        _WsProxy.CONNECTING = _OrigWebSocket.CONNECTING;
        _WsProxy.OPEN = _OrigWebSocket.OPEN;
        _WsProxy.CLOSING = _OrigWebSocket.CLOSING;
        _WsProxy.CLOSED = _OrigWebSocket.CLOSED;
        Object.defineProperty(_WsProxy, 'name', { value: 'WebSocket' });
        window.WebSocket = _WsProxy;
    }
})();
